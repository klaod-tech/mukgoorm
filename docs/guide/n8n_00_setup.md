# Step 0 — 사전 준비 (Supabase 테이블 생성)

> ⬅️ [목차로 돌아가기](n8n_ml_nodes.md)  
> ⏱️ 예상 소요 시간: 5분  
> **이 단계를 건너뛰면 이후 모든 n8n 노드가 에러 납니다. 반드시 먼저 실행하세요.**

---

## 0-1. Supabase SQL Editor 열기

1. [supabase.com](https://supabase.com) → 프로젝트 선택
2. 좌측 메뉴 → **SQL Editor** 클릭
3. **New Query** 클릭 (빈 쿼리 창 열기)

---

## 0-2. schemaV2.sql 내용 붙여넣고 실행

프로젝트 루트의 `supabase/schemaV2.sql` 파일 내용을 **전체 복사**해서  
SQL Editor 창에 붙여넣은 후 **Run** 버튼 클릭.

```
프로젝트 루트
└── supabase/
    └── schemaV2.sql   ← 이 파일 전체 복사
```

> 💡 **이미 실행한 적 있다면?**  
> SQL에 `IF NOT EXISTS`, `ON CONFLICT DO NOTHING` 등이 걸려 있어  
> 중복 실행해도 기존 데이터가 삭제되거나 에러가 나지 않습니다. 안전합니다.

---

## 0-3. 생성된 테이블 확인

SQL 실행 후 **Table Editor**에서 아래 3개 테이블이 있는지 확인하세요.

### ✅ 체크리스트

| 테이블 | 있어야 할 컬럼 | 확인 방법 |
|--------|--------------|---------|
| `user_preference_logits` | `user_id`, `category`, `logit`, `sample_count`, `updated_at` | Table Editor에서 클릭해서 컬럼 확인 |
| `worldcup_sessions` | `user_id`, `champion`, `rounds`, `completed`, `created_at` | Table Editor에서 클릭해서 컬럼 확인 |
| `food_feedback` | 기존 컬럼들 + `category` | columns 탭에서 `category` 컬럼 있는지 확인 |

### user_preference_logits 테이블 구조

```
id           : UUID (PK)
user_id      : TEXT  ← 유저 식별자
category     : TEXT  ← 한식/중식/양식/분식/일식/디저트/기타 중 하나
logit        : REAL  ← 선호도 점수 (초기값 0.0)
sample_count : INT   ← 해당 카테고리 피드백 횟수
updated_at   : TIMESTAMPTZ ← 마지막 업데이트 시각 (시간 감쇠에 사용)
```

---

## 0-4. 테스트용 데이터 삽입 (선택사항)

나중에 테스트할 때 쓸 초기 데이터를 미리 넣어둘 수 있습니다.

```sql
-- test_user_001이라는 유저의 초기 로짓 세팅
-- 한식을 매우 좋아하고, 분식도 좋아하는 유저로 설정
INSERT INTO user_preference_logits (user_id, category, logit, sample_count)
VALUES
  ('test_user_001', '한식',   3.0, 10),
  ('test_user_001', '중식',   0.5,  2),
  ('test_user_001', '양식',   0.3,  1),
  ('test_user_001', '분식',   2.1,  7),
  ('test_user_001', '일식',  -0.3,  1),
  ('test_user_001', '디저트', 0.0,  0),
  ('test_user_001', '기타',   0.0,  0)
ON CONFLICT (user_id, category)
DO UPDATE SET logit = EXCLUDED.logit, sample_count = EXCLUDED.sample_count;
```

---

## 0-5. n8n 연결 확인

n8n에 Supabase credential이 등록되어 있는지 확인합니다.

1. n8n → 우측 상단 설정 아이콘 → **Credentials**
2. `Supabase account` 또는 이와 유사한 이름이 있는지 확인
3. 없으면 **+ Add Credential** → `Supabase API` 선택 후 아래 입력:

```
Host         : https://xxxx.supabase.co   (프로젝트 URL)
Service Role : eyJ...                      (.env의 SUPABASE_SERVICE_KEY)
```

> ⚠️ **Service Role Key** 사용.  
> Anon Key는 RLS(Row Level Security)에 막혀서 insert가 안 될 수 있습니다.

---

## ✅ Step 0 완료 확인

```
[ ] SQL Editor에서 schemaV2.sql 실행 완료
[ ] user_preference_logits 테이블 존재 확인
[ ] worldcup_sessions 테이블 존재 확인
[ ] food_feedback 테이블에 category 컬럼 존재 확인
[ ] n8n에 Supabase credential 등록 확인
```

모두 체크됐으면 → [Step 1: 음식 추천 Softmax 적용](n8n_01_음식추천_Softmax.md) 진행
