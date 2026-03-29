"""
utils/ml.py
────────────────────────────────────────────────────────────────
칼로리 추정 보정 모듈 (ML 3순위)

역할:
  - GPT-4o가 추정한 칼로리를 사용자 개인 패턴 기반으로 보정
  - Ridge Regression / Random Forest로 학습
  - "조금", "한 그릇", "많이" 같은 표현의 개인차를 보정

데이터가 쌓이기 전엔 보정 없이 GPT 값을 그대로 사용.
학습 데이터가 30개 이상일 때 자동으로 모델 활성화.

의존성:
  pip install scikit-learn pandas numpy joblib
────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import logging
import os
import re
from datetime import date, timedelta
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline

from utils.db import get_meals_by_date, get_all_users

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# 상수
# ──────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "calorie_model.pkl")
MIN_SAMPLES_FOR_TRAINING = 30   # 최소 학습 데이터 수

# 양 표현 → 배율 매핑
QUANTITY_PATTERNS = {
    r"조금|약간|살짝|적게":           0.7,
    r"반|반쪽|절반":                   0.5,
    r"한 그릇|한그릇|1그릇|보통|일반": 1.0,
    r"두 그릇|두그릇|2그릇":           2.0,
    r"많이|가득|넉넉히|듬뿍":          1.4,
    r"조금 많이|좀 많이":              1.2,
    r"엄청|매우 많이|대식":            1.8,
}


# ──────────────────────────────────────────────
# 피처 엔지니어링
# ──────────────────────────────────────────────

def _extract_quantity_ratio(food_name: str) -> float:
    """
    음식명/입력 문자열에서 양 표현을 찾아 배율 반환.
    예: "치킨 조금" → 0.7
    """
    for pattern, ratio in QUANTITY_PATTERNS.items():
        if re.search(pattern, food_name):
            return ratio
    return 1.0


def _meal_type_to_int(meal_type: str) -> int:
    """끼니 → 정수 인코딩"""
    mapping = {"아침": 0, "점심": 1, "저녁": 2, "간식": 3, "식사": 1}
    return mapping.get(meal_type, 1)


def _build_features(food_name: str,
                    meal_type: str,
                    gpt_calories: int,
                    weekday: int,
                    hour: int) -> np.ndarray:
    """
    단일 식사 기록에서 피처 벡터 생성.

    피처:
        [gpt_calories, quantity_ratio, meal_type_int,
         weekday, hour, is_weekend]
    """
    qty_ratio    = _extract_quantity_ratio(food_name)
    meal_int     = _meal_type_to_int(meal_type)
    is_weekend   = int(weekday >= 5)

    return np.array([
        gpt_calories,
        qty_ratio,
        meal_int,
        weekday,
        hour,
        is_weekend,
    ], dtype=float)


def _load_training_data(user_id: str,
                        days: int = 90) -> tuple[np.ndarray, np.ndarray]:
    """
    DB에서 최근 `days`일치 식사 기록을 불러와 피처/레이블 반환.

    현재는 GPT 값을 Y로 사용 (ground truth가 없으므로).
    실제 체중 변화 데이터가 추가되면 보정 가능.
    """
    X_rows, y_rows = [], []
    today = date.today()

    for offset in range(days):
        target_date = today - timedelta(days=offset)
        meals = get_meals_by_date(user_id, target_date)

        for m in meals:
            gpt_cal = int(m.get("calories") or 0)
            if gpt_cal <= 0:
                continue

            features = _build_features(
                food_name    = m.get("food_name", ""),
                meal_type    = m.get("meal_type", "식사"),
                gpt_calories = gpt_cal,
                weekday      = target_date.weekday(),
                hour         = _parse_hour(m.get("recorded_at")),
            )
            X_rows.append(features)
            y_rows.append(gpt_cal)   # 현재는 GPT 값 = label

    if not X_rows:
        return np.empty((0, 6)), np.empty(0)

    return np.array(X_rows), np.array(y_rows)


def _parse_hour(recorded_at) -> int:
    """recorded_at에서 시(hour)만 추출. 실패 시 12 반환."""
    try:
        if recorded_at is None:
            return 12
        return pd.Timestamp(str(recorded_at)).hour
    except Exception:
        return 12


# ──────────────────────────────────────────────
# 모델 학습 / 저장 / 로드
# ──────────────────────────────────────────────

def train_calorie_model(user_id: str) -> Optional[Pipeline]:
    """
    사용자 데이터로 칼로리 보정 모델 학습 후 저장.

    Returns: 학습된 Pipeline 또는 None (데이터 부족)
    """
    X, y = _load_training_data(user_id)

    if len(X) < MIN_SAMPLES_FOR_TRAINING:
        logger.info(
            f"[ml] 학습 데이터 부족: {len(X)}개 / 최소 {MIN_SAMPLES_FOR_TRAINING}개 필요"
        )
        return None

    # Ridge vs Random Forest — 교차검증으로 선택
    ridge_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("model",  Ridge(alpha=1.0)),
    ])
    rf_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("model",  RandomForestRegressor(n_estimators=50, random_state=42)),
    ])

    ridge_score = cross_val_score(ridge_pipe, X, y, cv=3,
                                  scoring="neg_mean_absolute_error").mean()
    rf_score    = cross_val_score(rf_pipe,    X, y, cv=3,
                                  scoring="neg_mean_absolute_error").mean()

    best_pipe = ridge_pipe if ridge_score >= rf_score else rf_pipe
    best_name = "Ridge" if ridge_score >= rf_score else "RandomForest"
    best_pipe.fit(X, y)

    # 모델 저장
    os.makedirs(MODEL_DIR, exist_ok=True)
    save_path = MODEL_PATH.replace(".pkl", f"_{user_id}.pkl")
    joblib.dump(best_pipe, save_path)

    logger.info(
        f"[ml] 모델 저장 완료 | 사용자={user_id} | "
        f"알고리즘={best_name} | 샘플={len(X)}개 | "
        f"MAE≈{abs(best_score(ridge_score, rf_score)):.1f}kcal"
    )
    return best_pipe


def best_score(a, b):
    return a if a >= b else b


def load_calorie_model(user_id: str) -> Optional[Pipeline]:
    """저장된 모델 로드. 없으면 None 반환."""
    path = MODEL_PATH.replace(".pkl", f"_{user_id}.pkl")
    if not os.path.exists(path):
        return None
    try:
        return joblib.load(path)
    except Exception as e:
        logger.warning(f"[ml] 모델 로드 실패: {e}")
        return None


# ──────────────────────────────────────────────
# 메인 진입점 — 칼로리 보정
# ──────────────────────────────────────────────

def correct_calories(user_id: str,
                     food_name: str,
                     meal_type: str,
                     gpt_calories: int,
                     recorded_at=None) -> dict:
    """
    GPT 추정 칼로리를 ML 모델로 보정.

    Parameters
    ----------
    user_id       : 사용자 ID
    food_name     : 음식명 (양 표현 포함)
    meal_type     : 아침/점심/저녁/간식
    gpt_calories  : GPT-4o가 추정한 칼로리
    recorded_at   : 식사 시각 (None이면 현재 시각)

    Returns
    -------
    {
        "original_cal"  : int,   # GPT 원본 칼로리
        "corrected_cal" : int,   # 보정된 칼로리
        "model_used"    : bool,  # 모델 사용 여부
        "correction_pct": float, # 보정 비율 (%)
    }
    """
    result = {
        "original_cal":   gpt_calories,
        "corrected_cal":  gpt_calories,
        "model_used":     False,
        "correction_pct": 0.0,
    }

    # 1. 양 표현 기반 즉시 보정 (모델 없어도 동작)
    qty_ratio = _extract_quantity_ratio(food_name)
    if qty_ratio != 1.0:
        result["corrected_cal"] = int(gpt_calories * qty_ratio)
        result["correction_pct"] = (qty_ratio - 1.0) * 100

    # 2. 개인화 모델 보정
    model = load_calorie_model(user_id)
    if model is not None:
        try:
            now = pd.Timestamp(str(recorded_at)) if recorded_at else pd.Timestamp.now()
            features = _build_features(
                food_name    = food_name,
                meal_type    = meal_type,
                gpt_calories = gpt_calories,
                weekday      = now.weekday(),
                hour         = now.hour,
            )
            predicted = int(model.predict([features])[0])

            # 보정값이 원본의 50%~200% 범위를 벗어나면 무시 (안전장치)
            if gpt_calories * 0.5 <= predicted <= gpt_calories * 2.0:
                result["corrected_cal"]  = predicted
                result["model_used"]     = True
                result["correction_pct"] = (
                    (predicted - gpt_calories) / gpt_calories * 100
                    if gpt_calories else 0
                )
        except Exception as e:
            logger.warning(f"[ml] 모델 예측 오류: {e}")

    return result


# ──────────────────────────────────────────────
# 정기 학습 트리거 (scheduler에서 호출)
# ──────────────────────────────────────────────

def retrain_all_users() -> None:
    """
    전체 유저 모델 재학습.
    APScheduler에서 주 1회 호출 권장.
    """
    users = get_all_users()
    logger.info(f"[ml] 전체 유저 모델 재학습 시작 ({len(users)}명)")

    for user in users:
        uid = user.get("user_id")
        if uid:
            try:
                train_calorie_model(uid)
            except Exception as e:
                logger.warning(f"[ml] {uid} 재학습 실패: {e}")

    logger.info("[ml] 전체 재학습 완료")


# ──────────────────────────────────────────────
# 빠른 테스트용 (직접 실행 시)
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from dotenv import load_dotenv
    load_dotenv()

    print("=" * 60)
    print("칼로리 보정 모듈 테스트")
    print("=" * 60)

    # 양 표현 보정 테스트 (모델 없이도 동작)
    test_cases = [
        ("치킨 조금",    "저녁", 600),
        ("비빔밥 한 그릇", "점심", 550),
        ("라면 두 그릇",  "저녁", 500),
        ("샐러드 많이",   "아침", 200),
        ("삼겹살",        "저녁", 900),
    ]

    for food, meal, cal in test_cases:
        res = correct_calories("test_user", food, meal, cal)
        diff = res["corrected_cal"] - res["original_cal"]
        sign = "+" if diff >= 0 else ""
        print(
            f"  {food:<15} | GPT: {cal}kcal → 보정: {res['corrected_cal']}kcal "
            f"({sign}{diff}kcal, 모델사용={res['model_used']})"
        )
