"""
utils/image.py — 다마고치 상태 수치 기반 이미지 선택 로직

이미지 선택 우선순위:
  1순위: 특별 이벤트 (goal_achieved)
  2순위: 식사 상태 (eating)
  3순위: 배고픔 (hungry / hungry_cry 통합 → upset.png)
  4순위: 날씨 (dusty, rainy, snowy, cold, hot)
  5순위: 기본 감정 (tired+sick 통합, normal, happy)

실제 이미지 파일 목록:
  cheer.png, eat.png, hot.png, normal.png, rainy.png,
  smile.png, snow.png, tired.png, upset.png, warm.png, wear mask.png
"""

from datetime import datetime, timedelta


def select_image(
    tama: dict,
    user: dict,
    weather: dict | None = None,
    *,
    just_ate: bool = False,
    overfed: bool = False,
    underfed: bool = False,
    goal_achieved: bool = False,
) -> str:
    hp      = tama.get("hp", 70)
    hunger  = tama.get("hunger", 70)
    mood    = tama.get("mood", 70)
    last_fed_at = tama.get("last_fed_at")

    # ── 1순위: 특별 이벤트 ──────────────────────────────
    if goal_achieved:
        return "cheer.png"

    # ── 2순위: 식사 직후 ─────────────────────────────────
    if just_ate or _within_minutes(last_fed_at, 3):
        return "eat.png"

    # ── 3순위: 배고픔 (hungry + hungry_cry 통합) ─────────
    if hunger < 40:
        return "upset.png"

    # ── 4순위: 날씨 ──────────────────────────────────────
    if weather:
        img = _weather_image(weather)
        if img:
            return img

    # ── 5순위: 기본 감정 ─────────────────────────────────
    if hp < 40 or mood < 40:       # sick + tired 통합
        return "tired.png"
    if hp >= 70 and hunger >= 70 and mood >= 70:
        return "smile.png"
    return "normal.png"


def _within_minutes(last_fed_at: str | None, minutes: int) -> bool:
    if not last_fed_at:
        return False
    try:
        fed_time = datetime.fromisoformat(str(last_fed_at))
        return datetime.now() - fed_time <= timedelta(minutes=minutes)
    except (ValueError, TypeError):
        return False


def _weather_image(weather: dict) -> str | None:
    w_text = (weather.get("weather") or "").strip()
    temp   = weather.get("temp")
    pm10   = weather.get("pm10") or 0
    pm25   = weather.get("pm25") or 0

    if pm10 > 80 or pm25 > 35:
        return "wear mask.png"
    if any(k in w_text for k in ("비", "소나기")):
        return "rainy.png"
    if "눈" in w_text:
        return "snow.png"
    if temp is not None:
        if temp >= 26:
            return "hot.png"
        if temp <= 5:
            return "warm.png"
    # 맑음(sunny), 흐림(cloudy) → 전용 이미지 없음, 감정 상태로 넘어감
    return None


# 이미지별 설명 (Embed alt-text 등에 활용)
IMAGE_DESCRIPTIONS: dict[str, str] = {
    "cheer.png":      "목표 달성! 🎉",
    "eat.png":        "냠냠 먹는 중 😋",
    "upset.png":      "배고파... 🥺",
    "wear mask.png":  "미세먼지 많은 날 😷",
    "rainy.png":      "비 오는 날 🌧️",
    "snow.png":       "눈 오는 날 ❄️",
    "warm.png":       "추운 날 따뜻하게 🧥",
    "hot.png":        "더운 날 ☀️🥵",
    "tired.png":      "피곤하고 힘들어... 😴",
    "normal.png":     "오늘도 무난무난~ 😐",
    "smile.png":      "기분 최고! 😄",
}
