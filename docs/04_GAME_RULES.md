# 게임 규칙 — 수치 변화 & 이미지 시스템

## 수치 변화 규칙

### hunger (배부름, 높을수록 배부름)
| 상황 | 변화 |
|------|------|
| 적정 식사 (400~799 kcal) | +35 |
| 과식 (800 kcal 이상) | +50 |
| 소식 (400 kcal 미만) | +15 |
| 시간 경과 | -5/시간 |
| hunger = 0 | 유지 (사망 없음, hungry_cry 이미지 유지) |

> **구현 위치**: `utils/embed.py` → `_hunger_gain(calories)`

### hp (건강)
| 상황 | 변화 |
|------|------|
| 식사 입력 | +5 |
| 과식 3일 연속 | -10 |
| 소식 3일 연속 | -10 |

### mood (기분)
| 상황 | 변화 |
|------|------|
| 식사 입력 | +5 |
| 오늘 요약 버튼 클릭 | +3 |
| hunger < 30 | -10 |

### 이벤트 효과 코드 참조
```python
EVENT_EFFECTS = {
    "meal_input": {"hunger": +35, "mood": +5, "hp": +5},
    "overmeal":   {"hunger": +50},
    "undermeal":  {"hunger": +15},
}
```

---

## 이미지 선택 우선순위

```
1순위: 특별 이벤트    goal_achieved, birthday
2순위: 식사 상태      eating, overfed, underfed
3순위: 배고픔         hungry_cry, hungry
4순위: 날씨           dusty > rainy/snowy > hot/cold > sunny/cloudy
5순위: 기본 감정      sick < tired < normal < happy
```

> **구현 위치**: `utils/image.py` → `select_image()`

---

## 이미지 트리거 조건

| 파일명 | 트리거 조건 |
|--------|------------|
| `goal_achieved.png` | 목표 체중 달성 |
| `eating.png` | 식사 입력 직후 3분 이내 |
| `overfed.png` | 오후 10시 총 칼로리 > daily_cal_target |
| `underfed.png` | 오후 10시 총 칼로리 < daily_cal_target × 0.67 |
| `hungry_cry.png` | hunger < 20 (식사 알림 +1시간 미입력) |
| `hungry.png` | hunger < 40 (식사 알림 정각 미입력) |
| `dusty.png` | PM10 > 80 OR PM2.5 > 35 |
| `rainy.png` | 날씨 = 비/소나기 |
| `snowy.png` | 날씨 = 눈 |
| `hot.png` | 맑음 + 기온 ≥ 26°C |
| `cold.png` | 맑음 + 기온 ≤ 5°C |
| `sunny.png` | 맑음 + 15~25°C |
| `cloudy.png` | 흐림/구름많음 |
| `sick.png` | hp < 40 |
| `tired.png` | mood < 40 |
| `happy.png` | hp ≥ 70, hunger ≥ 70, mood ≥ 70 |
| `normal.png` | 모든 수치 40~69 (기본값) |

---

## 현재 images/ 폴더 상태

| 실제 파일명 | 매핑 대상 | 상태 |
|-------------|-----------|------|
| `normal.png` | `normal.png` | ✅ |
| `tired.png` | `tired.png` | ✅ |
| `hot.png` | `hot.png` | ✅ |
| `snow.png` | `snowy.png` | ⚠️ 이름 불일치 |
| `rainy.png` | `rainy.png` | ✅ |
| `eat.png` | `eating.png` | ⚠️ 이름 불일치 |
| `smile.png` | `happy.png` (?) | ⚠️ 확인 필요 |
| `warm.png` | `sunny.png` (?) | ⚠️ 확인 필요 |
| `cheer.png` | ? | ⚠️ 확인 필요 |
| `upset.png` | ? | ⚠️ 확인 필요 |
| `wear mask.png` | `dusty.png` | ⚠️ 이름 불일치 (공백 포함) |

> **미구현 이미지**: hungry.png, hungry_cry.png, overfed.png, underfed.png, sick.png, cold.png, cloudy.png, goal_achieved.png  
> **담당**: 이미지 파일명 최종 결정 후 image.py 트리거 조건과 맞춰야 함
