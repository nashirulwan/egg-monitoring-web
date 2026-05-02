#!/usr/bin/env python3
import json
import math
import os
import sys
from datetime import datetime


def require_modules():
    try:
        import numpy as np  # noqa: F401
        from sklearn.ensemble import IsolationForest, RandomForestClassifier  # noqa: F401
        from sklearn.metrics import accuracy_score, mean_absolute_error  # noqa: F401
        from xgboost import XGBRegressor  # noqa: F401
    except ImportError as exc:
        print("Missing Python dependency for AI training:", exc, file=sys.stderr)
        print(
            "Install with one of these options:\n"
            "1) pip install numpy scikit-learn xgboost\n"
            "2) nix shell nixpkgs#python313 nixpkgs#python313Packages.numpy "
            "nixpkgs#python313Packages.scikit-learn nixpkgs#python313Packages.xgboost",
            file=sys.stderr,
        )
        sys.exit(1)


require_modules()

import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import accuracy_score, mean_absolute_error
from xgboost import XGBRegressor


STATUS_TO_INT = {"Afkir": 0, "Perlu Dipantau": 1, "Produktif": 2}
INT_TO_STATUS = {value: key for key, value in STATUS_TO_INT.items()}
FEATURE_ORDER = [
    "sensorIndex",
    "prevMonthlyEggs",
    "prevEggs7d",
    "daysWithoutEgg",
    "avgTemp30d",
    "avgHumidity30d",
    "gasAlertCount30d",
    "gasAlertCount7d",
    "rollingEggAvg2m",
]


def load_payload(dataset_path):
    with open(dataset_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def matrix_from_rows(rows):
    return np.array(
        [[float(row["features"][feature]) for feature in FEATURE_ORDER] for row in rows],
        dtype=float,
    )


def normalize_anomaly(raw_scores):
    if len(raw_scores) == 0:
      return []
    low = min(raw_scores)
    high = max(raw_scores)
    if math.isclose(low, high):
        return [0.15 for _ in raw_scores]
    normalized = []
    for score in raw_scores:
        normalized_score = 1.0 - ((score - low) / (high - low))
        normalized.append(round(float(normalized_score), 2))
    return normalized


def anomaly_label(score):
    if score >= 0.6:
        return "Tinggi"
    if score >= 0.35:
        return "Sedang"
    return "Rendah"


def main():
    dataset_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.getcwd(), "artifacts", "ai-dataset.json")
    output_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.getcwd(), "artifacts", "ai-predictions.json")
    payload = load_payload(dataset_path)
    train_rows = payload["trainRows"]
    prediction_rows = payload["predictionRows"]

    if len(train_rows) < 4:
        raise RuntimeError("Not enough rows to train AI models. Seed more monthly history first.")

    X = matrix_from_rows(train_rows)
    y_reg = np.array([float(row["target"]["monthlyEggs"]) for row in train_rows], dtype=float)
    y_cls = np.array([STATUS_TO_INT[row["target"]["status"]] for row in train_rows], dtype=int)

    split_index = max(1, int(len(train_rows) * 0.75))
    split_index = min(split_index, len(train_rows) - 1)

    X_train, X_test = X[:split_index], X[split_index:]
    y_reg_train, y_reg_test = y_reg[:split_index], y_reg[split_index:]
    y_cls_train, y_cls_test = y_cls[:split_index], y_cls[split_index:]

    regressor = XGBRegressor(
        n_estimators=120,
        max_depth=3,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
    )
    regressor.fit(X_train, y_reg_train)

    classifier = RandomForestClassifier(
        n_estimators=200,
        max_depth=6,
        min_samples_leaf=1,
        random_state=42,
    )
    classifier.fit(X_train, y_cls_train)

    anomaly_model = IsolationForest(
        n_estimators=150,
        contamination=0.2,
        random_state=42,
    )
    anomaly_model.fit(X_train)

    reg_pred_test = regressor.predict(X_test)
    cls_pred_test = classifier.predict(X_test)
    raw_anomaly_test = anomaly_model.score_samples(X_test)

    metrics = {
        "regression_mae": round(float(mean_absolute_error(y_reg_test, reg_pred_test)), 3),
        "classification_accuracy": round(float(accuracy_score(y_cls_test, cls_pred_test)), 3),
        "test_rows": int(len(X_test)),
    }

    X_future = matrix_from_rows(prediction_rows)
    reg_future = regressor.predict(X_future)
    cls_future = classifier.predict(X_future)
    cls_future_proba = classifier.predict_proba(X_future)
    future_anomaly_raw = anomaly_model.score_samples(X_future)
    future_anomaly = normalize_anomaly(future_anomaly_raw.tolist())

    target_month = prediction_rows[0]["targetMonth"] if prediction_rows else None
    model_version = "xgb-rf-iforest-v1"
    generated_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    predictions = []
    for index, row in enumerate(prediction_rows):
        predicted_monthly = max(0.0, round(float(reg_future[index]), 1))
        predicted_status = INT_TO_STATUS[int(cls_future[index])]
        confidence = round(float(max(cls_future_proba[index])), 2)
        afkir_probability = 0.0
        warning_probability = 0.0
        if classifier.classes_.tolist().count(0):
            afkir_probability = float(cls_future_proba[index][classifier.classes_.tolist().index(0)])
        if classifier.classes_.tolist().count(1):
            warning_probability = float(cls_future_proba[index][classifier.classes_.tolist().index(1)])
        afkir_risk_score = round(min(0.99, max(0.05, afkir_probability + (warning_probability * 0.45))), 2)
        anomaly_score = future_anomaly[index]
        predictions.append({
            "deviceId": row["deviceId"],
            "sensorId": row["sensorId"],
            "predictedEggs7d": round(predicted_monthly / max(row["targetMonthDays"], 1) * 7, 1),
            "predictedEggs30d": predicted_monthly,
            "predictedMonthlyEggs": predicted_monthly,
            "predictedStatus": predicted_status,
            "confidence": confidence,
            "afkirRiskScore": afkir_risk_score,
            "anomalyScore": anomaly_score,
            "anomalyLabel": anomaly_label(anomaly_score),
            "featureSnapshot": {
                "sourceMonth": row["sourceMonth"],
                "prevMonthlyEggs": row["features"]["prevMonthlyEggs"],
                "prevEggs7d": row["features"]["prevEggs7d"],
                "daysWithoutEgg": row["features"]["daysWithoutEgg"],
                "avgTemp30d": row["features"]["avgTemp30d"],
                "avgHumidity30d": row["features"]["avgHumidity30d"],
                "gasAlertCount30d": row["features"]["gasAlertCount30d"],
                "gasAlertCount7d": row["features"]["gasAlertCount7d"],
                "rollingEggAvg2m": row["features"]["rollingEggAvg2m"],
            },
        })

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "generatedAt": generated_at,
                "targetMonth": target_month,
                "modelVersion": model_version,
                "metrics": metrics,
                "predictions": predictions,
                "testSamples": [
                    {
                        "targetMonth": train_rows[split_index + offset]["targetMonth"],
                        "sensorId": train_rows[split_index + offset]["sensorId"],
                        "actualMonthlyEggs": float(y_reg_test[offset]),
                        "predictedMonthlyEggs": round(float(reg_pred_test[offset]), 1),
                        "actualStatus": INT_TO_STATUS[int(y_cls_test[offset])],
                        "predictedStatus": INT_TO_STATUS[int(cls_pred_test[offset])],
                        "anomalyScore": normalize_anomaly(raw_anomaly_test.tolist())[offset] if len(raw_anomaly_test) else 0.15,
                    }
                    for offset in range(len(X_test))
                ],
            },
            handle,
            indent=2,
        )

    print(f"AI predictions written to {output_path}")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
