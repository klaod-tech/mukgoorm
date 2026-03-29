"""
utils/pattern.py
────────────────────────────────────────────────────────────────
식습관 패턴 분석 모듈 (ML 1순위)

역할:
  - DB의 Meals 테이블에서 최근 n일치 식사 데이터를 불러와
  - 요일별 과식 경향, 아침 결식 패턴, 저녁 집중 섭취 등을 탐지
  - 탐지된 패턴을 자연어 문장으로 반환 → GPT System Prompt에 주입

의존성:
  pip install pandas numpy scikit-learn

Prophet은 데이터가 14일 이상 쌓였을 때 선택적으로 사용.
그 전에는 pandas 통계 기반으로 동일 인터페이스 제공.
────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional

import numpy as np
import pandas as pd

# DB 연결은 기존 utils/db.py 함수를 재사용
from utils.db import get_meals_by_date, get_all_users

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# 상수
# ──────────────────────────────────────────────
DAYS_LOOKBACK = 14          # 분석에 사용할 최근 일수
OVERFED_RATIO = 1.1         # 목표 칼로리의 110% 이상 → 과식 판정
UNDERFED_RATIO = 0.67       # 목표 칼로리의 67% 미만 → 소식 판정
MIN_DAYS_FOR_PATTERN = 7    # 패턴 탐지를 위한 최소 데이터 일수

WEEKDAY_KR = ["월", "화", "수", "목", "금", "토", "일"]


# ──────────────────────────────────────────────
# 데이터 로딩
# ──────────────────────────────────────────────

def _load_meal_dataframe(user_id: str, days: int = DAYS_LOOKBACK) -> pd.DataFrame:
    """
    DB에서 최근 `days`일치 식사 기록을 불러와 DataFrame으로 반환.

    반환 컬럼:
        date        : date 객체
        weekday     : 0=월 ~ 6=일
        meal_type   : 아침/점심/저녁/간식
        calories    : int
        protein     : float
        carbs       : float
        fat         : float
    """
    rows = []
    today = date.today()

    for offset in range(days):
        target_date = today - timedelta(days=offset)
        meals = get_meals_by_date(user_id, target_date)   # List[dict]
        for m in meals:
            rows.append({
                "date":      target_date,
                "weekday":   target_date.weekday(),       # 0=월요일
                "meal_type": m.get("meal_type", "식사"),
                "calories":  int(m.get("calories") or 0),
                "protein":   float(m.get("protein") or 0),
                "carbs":     float(m.get("carbs") or 0),
                "fat":       float(m.get("fat") or 0),
            })

    if not rows:
        return pd.DataFrame(columns=["date", "weekday", "meal_type",
                                      "calories", "protein", "carbs", "fat"])

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    return df


def _daily_summary(df: pd.DataFrame) -> pd.DataFrame:
    """
    날짜별 합계 DataFrame 생성.
    반환 컬럼: date, weekday, total_cal, has_breakfast, has_lunch, has_dinner, evening_ratio
    """
    if df.empty:
        return pd.DataFrame()

    daily = (
        df.groupby("date")
        .agg(
            weekday=("weekday", "first"),
            total_cal=("calories", "sum"),
        )
        .reset_index()
    )

    # 끼니별 유무 플래그
    for meal, col in [("아침", "has_breakfast"), ("점심", "has_lunch"), ("저녁", "has_dinner")]:
        mask = df[df["meal_type"] == meal].groupby("date")["calories"].sum().gt(0)
        daily[col] = daily["date"].isin(mask[mask].index)

    # 저녁 칼로리 비율
    dinner_cal = (
        df[df["meal_type"] == "저녁"]
        .groupby("date")["calories"]
        .sum()
        .rename("dinner_cal")
    )
    daily = daily.merge(dinner_cal, on="date", how="left").fillna({"dinner_cal": 0})
    daily["evening_ratio"] = daily.apply(
        lambda r: r["dinner_cal"] / r["total_cal"] if r["total_cal"] > 0 else 0,
        axis=1,
    )

    return daily


# ──────────────────────────────────────────────
# 패턴 탐지 함수
# ──────────────────────────────────────────────

def detect_weekday_overeating(daily: pd.DataFrame,
                               daily_cal_target: int) -> Optional[str]:
    """
    특정 요일에 과식이 반복되는 패턴 탐지.

    예: "매주 금요일 저녁 과식 경향이 있어요."
    """
    if daily.empty or len(daily) < MIN_DAYS_FOR_PATTERN:
        return None

    threshold = daily_cal_target * OVERFED_RATIO

    # 요일별 과식 횟수
    daily["overfed"] = daily["total_cal"] > threshold
    weekday_overfed = daily.groupby("weekday")["overfed"].mean()  # 비율

    # 과식 비율 50% 이상인 요일
    high_days = weekday_overfed[weekday_overfed >= 0.5].index.tolist()
    if not high_days:
        return None

    day_names = ", ".join(f"{WEEKDAY_KR[d]}요일" for d in sorted(high_days))
    return f"매주 {day_names}에 목표 칼로리를 초과하는 경향이 있어요."


def detect_breakfast_skipping(daily: pd.DataFrame) -> Optional[str]:
    """
    아침 결식 패턴 탐지.

    예: "아침을 자주 거르고 있어요 (최근 14일 중 9일)."
    """
    if daily.empty or "has_breakfast" not in daily.columns:
        return None

    total_days = len(daily)
    skip_days = total_days - daily["has_breakfast"].sum()

    if skip_days / total_days >= 0.5:  # 50% 이상 결식
        return f"아침을 자주 거르고 있어요. (최근 {total_days}일 중 {int(skip_days)}일 결식)"

    return None


def detect_evening_heavy(daily: pd.DataFrame) -> Optional[str]:
    """
    저녁 칼로리 집중 패턴 탐지.

    예: "저녁 식사에 하루 칼로리의 50% 이상을 섭취하고 있어요."
    """
    if daily.empty or "evening_ratio" not in daily.columns:
        return None

    avg_ratio = daily["evening_ratio"].mean()
    if avg_ratio >= 0.5:
        pct = int(avg_ratio * 100)
        return f"저녁에 하루 칼로리의 평균 {pct}%를 섭취하고 있어요. 저녁 과식 패턴이에요."

    return None


def detect_weekly_trend(daily: pd.DataFrame, daily_cal_target: int) -> Optional[str]:
    """
    최근 7일 vs 이전 7일 칼로리 추이 비교.

    예: "이번 주 평균 섭취량이 지난 주보다 200kcal 늘었어요."
    """
    if len(daily) < 14:
        return None

    sorted_daily = daily.sort_values("date")
    first_half  = sorted_daily.iloc[:7]["total_cal"].mean()
    second_half = sorted_daily.iloc[7:]["total_cal"].mean()

    diff = int(second_half - first_half)
    if abs(diff) < 100:          # 100kcal 이하 변화는 무시
        return None

    direction = "늘었어요" if diff > 0 else "줄었어요"
    return f"이번 주 평균 섭취량이 지난 주보다 {abs(diff)}kcal {direction}."


def detect_undereating_streak(daily: pd.DataFrame,
                               daily_cal_target: int) -> Optional[str]:
    """
    연속 소식 패턴 탐지.

    예: "최근 3일 연속으로 목표 칼로리의 67% 미만만 먹었어요."
    """
    if daily.empty:
        return None

    threshold = daily_cal_target * UNDERFED_RATIO
    sorted_daily = daily.sort_values("date", ascending=False)

    streak = 0
    for _, row in sorted_daily.iterrows():
        if row["total_cal"] < threshold and row["total_cal"] > 0:
            streak += 1
        else:
            break

    if streak >= 3:
        return f"최근 {streak}일 연속으로 너무 적게 먹고 있어요. (목표의 67% 미만)"

    return None


# ──────────────────────────────────────────────
# 메인 진입점
# ──────────────────────────────────────────────

def analyze_eating_patterns(user_id: str,
                             daily_cal_target: int,
                             days: int = DAYS_LOOKBACK) -> dict:
    """
    식습관 패턴 분석 메인 함수.

    Parameters
    ----------
    user_id          : Meals 테이블의 user_id
    daily_cal_target : Users 테이블의 daily_cal_target
    days             : 분석할 최근 일수 (기본 14)

    Returns
    -------
    {
        "has_enough_data": bool,
        "patterns": List[str],     # 탐지된 패턴 문장 목록
        "gpt_context": str,        # GPT System Prompt에 바로 주입 가능한 문자열
        "stats": dict              # 디버깅용 수치 요약
    }
    """
    result = {
        "has_enough_data": False,
        "patterns": [],
        "gpt_context": "",
        "stats": {},
    }

    try:
        df = _load_meal_dataframe(user_id, days)

        if df.empty:
            result["gpt_context"] = "아직 식사 기록이 없어요."
            return result

        unique_days = df["date"].nunique()
        result["has_enough_data"] = unique_days >= MIN_DAYS_FOR_PATTERN
        result["stats"]["recorded_days"] = int(unique_days)
        result["stats"]["total_meals"] = len(df)

        daily = _daily_summary(df)

        if not result["has_enough_data"]:
            result["gpt_context"] = (
                f"아직 {unique_days}일치 기록만 있어요. "
                f"패턴 분석은 {MIN_DAYS_FOR_PATTERN}일 이상 데이터가 필요해요."
            )
            return result

        # ── 패턴 탐지 ──────────────────────────────────
        detectors = [
            detect_weekday_overeating(daily, daily_cal_target),
            detect_breakfast_skipping(daily),
            detect_evening_heavy(daily),
            detect_weekly_trend(daily, daily_cal_target),
            detect_undereating_streak(daily, daily_cal_target),
        ]

        patterns = [p for p in detectors if p]
        result["patterns"] = patterns

        # 평균 칼로리
        avg_cal = int(daily["total_cal"].mean())
        result["stats"]["avg_daily_cal"] = avg_cal
        result["stats"]["target_cal"] = daily_cal_target

        # ── GPT 주입용 컨텍스트 생성 ──────────────────
        if patterns:
            pattern_text = "\n".join(f"- {p}" for p in patterns)
            result["gpt_context"] = (
                f"[식습관 패턴 분석 — 최근 {unique_days}일 기준]\n"
                f"{pattern_text}\n"
                f"평균 일일 섭취량: {avg_cal}kcal / 목표: {daily_cal_target}kcal"
            )
        else:
            result["gpt_context"] = (
                f"[식습관 패턴 분석 — 최근 {unique_days}일 기준]\n"
                f"특별한 이상 패턴은 발견되지 않았어요. "
                f"평균 일일 섭취량: {avg_cal}kcal / 목표: {daily_cal_target}kcal"
            )

    except Exception as e:
        logger.exception(f"패턴 분석 오류 (user_id={user_id}): {e}")
        result["gpt_context"] = ""

    return result


# ──────────────────────────────────────────────
# Prophet 기반 고급 예측 (데이터 충분 시 활성화)
# ──────────────────────────────────────────────

def forecast_weekly_calories(user_id: str,
                              daily_cal_target: int,
                              forecast_days: int = 7) -> Optional[str]:
    """
    Prophet을 사용해 다음 주 칼로리 추이를 예측.
    Prophet 미설치 시 None 반환 (graceful fallback).

    Returns
    -------
    예측 요약 문자열 또는 None
    """
    try:
        from prophet import Prophet  # type: ignore
    except ImportError:
        logger.debug("Prophet 미설치 — 예측 기능 비활성화")
        return None

    try:
        df = _load_meal_dataframe(user_id, days=30)
        if df.empty or df["date"].nunique() < 14:
            return None

        daily = _daily_summary(df)[["date", "total_cal"]].rename(
            columns={"date": "ds", "total_cal": "y"}
        )
        daily["ds"] = pd.to_datetime(daily["ds"])

        model = Prophet(
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=False,
            changepoint_prior_scale=0.05,
        )
        model.fit(daily)

        future = model.make_future_dataframe(periods=forecast_days)
        forecast = model.predict(future)

        next_week = forecast.tail(forecast_days)
        avg_pred = int(next_week["yhat"].mean())
        diff = avg_pred - daily_cal_target

        if diff > 100:
            return f"다음 주 예상 평균 섭취량은 {avg_pred}kcal예요. 목표보다 {diff}kcal 많을 것 같아요."
        elif diff < -100:
            return f"다음 주 예상 평균 섭취량은 {avg_pred}kcal예요. 목표보다 {abs(diff)}kcal 적을 것 같아요."
        else:
            return f"다음 주 예상 평균 섭취량은 {avg_pred}kcal로 목표에 근접할 것 같아요."

    except Exception as e:
        logger.exception(f"Prophet 예측 오류: {e}")
        return None


# ──────────────────────────────────────────────
# 빠른 테스트용 (직접 실행 시)
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    import os

    # 프로젝트 루트 경로 추가
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

    # 환경변수 로드
    from dotenv import load_dotenv
    load_dotenv()

    TEST_USER_ID = "123456789"          # 테스트할 디스코드 유저 ID
    TEST_TARGET_CAL = 2000

    print("=" * 60)
    print("식습관 패턴 분석 테스트")
    print("=" * 60)

    result = analyze_eating_patterns(TEST_USER_ID, TEST_TARGET_CAL)
    print(f"\n✅ 데이터 충분 여부: {result['has_enough_data']}")
    print(f"\n📊 통계: {result['stats']}")
    print(f"\n🔍 탐지된 패턴 ({len(result['patterns'])}개):")
    for p in result["patterns"]:
        print(f"  - {p}")
    print(f"\n💬 GPT 주입 컨텍스트:\n{result['gpt_context']}")

    forecast = forecast_weekly_calories(TEST_USER_ID, TEST_TARGET_CAL)
    if forecast:
        print(f"\n🔮 Prophet 예측: {forecast}")
    else:
        print("\n🔮 Prophet 예측: 비활성화 (미설치 또는 데이터 부족)")
