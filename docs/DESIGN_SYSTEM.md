# 먹구름(mukgoorm) 디자인 시스템 — Claude Code 작업 지침서

> 이 문서는 Claude Code가 `web/` 의 React 프론트엔드를 리팩토링/스타일링할 때 따라야 할 **단일 기준(source of truth)** 입니다.
> 작업 시작 전 이 문서를 끝까지 읽고, 아래 규칙을 우선순위로 적용하세요.

---

## 0. 가장 먼저 할 일 (작업 순서)

1. **`src/styles/tokens.css`** 파일을 새로 만들고, 아래 §2 의 토큰을 그대로 정의한다.
2. **`src/index.css`** 상단에서 `@import './styles/tokens.css';` 로 토큰을 불러오고, body 배경/색을 토큰으로 교체한다.
3. **`src/App.css`** 의 Vite 기본 템플릿 잔재(`.hero`, `.vite`, `.framework`, `#next-steps`, `#docs`, `#spacer`, `.ticks`, `.counter` 등 — 실제 페이지에서 import/사용되지 않는 스타일)는 **전부 삭제**한다.
4. 각 페이지/컴포넌트의 **인라인 하드코딩 hex 색상**을 §3 매핑표대로 `var(--token)` 으로 치환한다.
5. 반복되는 카드/버튼/뱃지 패턴을 §6 예시처럼 정리한다.

> ⚠️ **기능 로직(데이터 흐름, n8n 호출, supabase 쿼리, 상태관리)은 절대 건드리지 말 것.** 이 작업은 100% 시각적 스타일링 한정입니다.

---

## 1. 디자인 컨셉 — "비 갠 하늘 ☁️→🌤️"

먹구름의 정체성은 **"수치를 숨기고 캐릭터와 대사로 따뜻하게 전달하는 다마고치 식습관 앱"** 입니다.
디자인도 차가운 대시보드가 아니라 **포근하고 친근한 라이트 테마**여야 합니다.

- **무드**: 비구름이 걷히고 맑아지는 하늘. 부드럽고, 둥글고, 따뜻함.
- **레퍼런스 정서**: 다마고치, 동물의 숲, 두근두근 문예부 같은 아기자기 감성 UI. 토스/뱅크샐러드 같은 차가운 핀테크 톤은 ❌.
- **캐릭터 친화**: NovelAI로 생성된 애니풍 캐릭터(크림 배경 · 살구빛 볼터치 · 부드러운 갈색 외곽선)가 배경에 자연스럽게 녹아들어야 한다. 그래서 배경은 **크림/연하늘**, 포인트는 **따뜻한 살구색**.

### 절대 하지 말 것 (anti-patterns)
- 기존 보라색 포인트(`#6c63ff`) 유지 ❌ — 진부하고 캐릭터와 충돌함. 살구색 계열로 전면 교체.
- 차가운 네이비 다크 배경(`#0f0f23`, `#1a1a2e`) 유지 ❌ — 라이트로 전환.
- 순흑(`#000`)·순백 텍스트 위 순백 배경 ❌ — 본문은 따뜻한 잉크색(`--text`) 사용.
- 직각 모서리, 그림자 없는 평면 카드 ❌ — 둥근 모서리 + 부드러운 그림자가 이 테마의 핵심.

---

## 2. 디자인 토큰 (`src/styles/tokens.css` 에 그대로 정의)

```css
:root {
  /* ── 배경 (비 갠 하늘: 위는 연하늘, 아래는 크림) ── */
  --bg:            #fbf7f0;   /* 앱 전체 배경 — 따뜻한 크림 */
  --bg-sky:        #eaf4fb;   /* 하늘색 섹션/그라데이션 상단 */
  --surface:       #ffffff;   /* 카드·패널 기본 면 */
  --surface-2:     #f4eee4;   /* 살짝 가라앉은 면(선택 안 된 항목, hover 베이스) */
  --surface-sky:   #e3f0f9;   /* 정보성 카드(날씨 등) 면 */

  /* ── 포인트 (따뜻한 살구 — 브랜드 메인) ── */
  --accent:        #f5a06a;   /* 메인 살구색 — 버튼·활성 상태 */
  --accent-strong: #ec8a4e;   /* hover/pressed 시 진한 살구 */
  --accent-soft:   #fbe3d0;   /* 살구 연한 배경(태그·뱃지 베이스) */
  --accent-ink:    #b5612c;   /* 살구 위/연한 배경 위 텍스트용 진한 톤 */

  /* ── 보조 포인트 (맑은 하늘색 — 정보/링크) ── */
  --sky:           #6cb6e8;
  --sky-soft:      #d6ecfa;
  --sky-ink:       #2f7cb5;

  /* ── 텍스트 (순흑 대신 따뜻한 잉크) ── */
  --text:          #4a3f3a;   /* 본문 — 따뜻한 다크 브라운그레이 */
  --text-strong:   #2e2724;   /* 제목·강조 */
  --text-muted:    #9a8d84;   /* 보조 설명·캡션 */
  --text-faint:    #c4b9b0;   /* 가장 약한 메타 텍스트 */
  --text-on-accent:#ffffff;   /* 살구 버튼 위 텍스트 */

  /* ── 경계선 ── */
  --border:        #ece3d6;   /* 기본 테두리 */
  --border-strong: #ddcfbd;   /* 강조 테두리 */

  /* ── 상태 색 ── */
  --success:       #5bb98c;
  --success-soft:  #dcf2e7;
  --danger:        #e8736b;
  --danger-soft:   #fbe0de;
  --warning:       #efb152;
  --warning-soft:  #fcefd4;

  /* ── 타이포 스케일 ── */
  --font-sans: 'Pretendard', 'Pretendard Variable', -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Segoe UI', sans-serif;
  --fs-xs:   11px;
  --fs-sm:   13px;
  --fs-base: 14px;
  --fs-md:   16px;
  --fs-lg:   18px;
  --fs-xl:   22px;
  --fs-2xl:  28px;
  --fw-regular: 400;
  --fw-medium:  500;
  --fw-bold:    700;
  --lh-tight: 1.3;
  --lh-base:  1.6;

  /* ── 간격 (8px 그리드) ── */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 20px;
  --sp-6: 24px;
  --sp-8: 32px;
  --sp-10: 40px;

  /* ── 모서리 (둥글게 — 다마고치 감성의 핵심) ── */
  --radius-sm:  8px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-xl:  20px;
  --radius-pill: 999px;

  /* ── 그림자 (부드럽고 따뜻하게, 검정 대신 갈색 베이스) ── */
  --shadow-sm:  0 1px 3px rgba(120, 90, 60, 0.08);
  --shadow-md:  0 4px 14px rgba(120, 90, 60, 0.10);
  --shadow-lg:  0 12px 32px rgba(120, 90, 60, 0.14);
  --shadow-accent: 0 4px 16px rgba(245, 160, 106, 0.35);

  /* ── 전환 ── */
  --transition: 0.18s ease;
}
```

> **폰트 안내**: Pretendard 를 권장합니다. 아직 설치 안 됐으면 `index.css` 상단에
> `@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');`
> 를 추가하세요. (CDN 사용 불가 환경이면 system-ui fallback 으로도 동작합니다.)

---

## 3. 하드코딩 색상 → 토큰 치환표

현재 코드는 인라인 스타일에 hex 가 박혀 있습니다. 아래 표대로 **전역 치환**하세요.
(빈도는 현재 코드 기준 등장 횟수 — 자주 쓰인 것부터 우선 처리)

| 기존 hex | 빈도 | → 교체할 토큰 | 비고 |
|----------|------|--------------|------|
| `#fff` / `#ffffff` | 64 | `var(--surface)` 또는 `var(--text-on-accent)` | **문맥 구분 필수** ↓ |
| `#6c63ff` | 48 | `var(--accent)` | 보라 포인트 → 살구. 활성/버튼/링크 강조 |
| `#555` | 38 | `var(--text-muted)` | 약한 텍스트 |
| `#2a2a4a` | 33 | `var(--border)` | 테두리. (배경으로 쓰인 곳은 `--surface-2`) |
| `#aaa` | 33 | `var(--text-muted)` | 보조 텍스트 |
| `#1a1a2e` | 23 | `var(--surface)` (카드 배경) / 사이드바는 `--surface` | 다크 카드 → 흰 카드 |
| `#16213e` | 16 | `var(--surface-2)` | 카드/활성 배경 |
| `#888` | 15 | `var(--text-muted)` | |
| `#ff6b6b` | 11 | `var(--danger)` | 실패/경고 |
| `#8900ff`,`#9135ff`,`#9c92ff` | 12 | `var(--accent)` 계열 | 보라 그라데이션 흔적 → 살구로 |
| `#0f0f23` / `#0f0f1e` | 11 | `var(--bg)` | 앱 배경 → 크림 |
| `#4caf50` / `#6ddf70` | 6 | `var(--success)` | |
| `#bbb` / `#ccc` | 6 | `var(--text-muted)` | |
| `#666` | 4 | `var(--text-muted)` | |
| `#eee6ff` | 3 | `var(--accent-soft)` | 연보라 배경 → 연살구 |
| `#1e1e3a` / `#252545` | 3 | `var(--surface-2)` | 선택된 카드 배경 |
| `#00c2ff` / `#63b3ff` / `#6c9fff` | 4 | `var(--sky)` | 정보성 파랑 → 하늘색 |
| `#f5a623` | 1 | `var(--warning)` | |
| `#c62828` | 1 | `var(--danger)` | |
| `#3a1a1a` / `#4a1a1a` | 3 | `var(--danger-soft)` | |
| `#1a4a1a` | 1 | `var(--success-soft)` | |
| `#1a2a3a` | 1 | `var(--sky-soft)` | |
| `#000` | 2 | `var(--text-strong)` | 순흑 금지 |
| 투명도 붙은 색<br>(`#6c63ff33`, `#ff6b6b88` 등) | 다수 | `color-mix(in srgb, var(--accent) 20%, transparent)` 형태로<br>또는 해당 `*-soft` 토큰으로 대체 | 아래 §3.1 참고 |

### 3.1 알파(투명도) 색 처리
`#6c63ff33`(20%), `#4caf5088`(53%) 같은 8자리 hex 는 다음 중 하나로:
- **테두리/은은한 배경**: 대응되는 `--*-soft` 토큰 사용 (예: `#6c63ff33` 테두리 → `var(--accent-soft)`)
- **그림자/글로우**: `--shadow-accent` 또는 `color-mix(in srgb, var(--accent) 35%, transparent)`

### 3.2 `#fff` 문맥 구분 (중요)
`#fff` 는 두 가지로 쓰이고 있으니 반드시 구분:
- **배경**으로 쓰인 `#fff` (카드 면, 사이드바 면) → `var(--surface)`
- **텍스트 색**으로 쓰인 `#fff` 중,
  - 살구 버튼 위 글자 → `var(--text-on-accent)`
  - 그 외 일반 텍스트(다크 배경 가정이던 곳) → 라이트 전환이므로 **`var(--text-strong)` 또는 `var(--text)`** 로 바꿔야 함. (흰 글자를 흰 배경에 두면 안 보임 — 라이트 전환의 핵심 함정)

---

## 4. 컴포넌트 스타일 규칙

### 카드 (RestaurantCard, WeatherCard, MenuItemRow 등)
- 배경 `var(--surface)`, 테두리 `1px solid var(--border)`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-sm)`.
- hover 시 `box-shadow: var(--shadow-md)` + `transform: translateY(-2px)` (transition 적용).
- **선택/활성** 상태: 테두리 `var(--accent)`, 배경 `var(--accent-soft)` 살짝, `box-shadow: var(--shadow-accent)`.
- 정보성 카드(WeatherCard)는 `var(--surface-sky)` 배경 + 하늘색 악센트로 차별화 가능.

### 버튼
| 종류 | 배경 | 텍스트 | 비고 |
|------|------|--------|------|
| Primary | `var(--accent)` | `var(--text-on-accent)` | hover: `var(--accent-strong)`, `box-shadow: var(--shadow-accent)` |
| Ghost/Secondary | `var(--surface-2)` | `var(--text)` | hover: `var(--border)` |
| Disabled | `var(--surface-2)` | `var(--text-faint)` | `cursor: default; opacity: 0.7` |
- 모든 버튼 `border-radius: var(--radius-pill)` (둥근 알약형) 또는 액션 버튼은 `var(--radius-md)`.
- `padding: var(--sp-3) var(--sp-5)`, `font-weight: var(--fw-bold)`, `transition: var(--transition)`.

### 뱃지/태그 (분류 태그, 키워드 칩)
- `var(--accent-soft)` 배경 + `var(--accent-ink)` 텍스트 + `border-radius: var(--radius-pill)`.
- 정보성(키워드 등)은 `var(--sky-soft)` / `var(--sky-ink)` 조합.
- `font-size: var(--fs-xs)`, `padding: 2px var(--sp-2)`.

### 채팅 말풍선 (Home)
- 유저 말풍선: `var(--accent)` 배경, `var(--text-on-accent)` 텍스트.
- 봇 말풍선: `var(--surface)` 배경, `var(--text)` 텍스트, `1px solid var(--border)`, `box-shadow: var(--shadow-sm)`.
- 모서리 비대칭(`16px 16px 4px 16px`)은 유지 — 귀여운 디테일이라 좋음.

### 입력창
- `var(--surface)` 배경, `1px solid var(--border)`, `border-radius: var(--radius-pill)`.
- focus 시 `border-color: var(--accent)` + `box-shadow: 0 0 0 3px var(--accent-soft)`.

### 모달
- 오버레이: `rgba(74, 63, 58, 0.45)` (검정 대신 따뜻한 톤) + `backdrop-filter: blur(2px)`.
- 패널: `var(--surface)`, `border-radius: var(--radius-xl)`, `box-shadow: var(--shadow-lg)`.

### 사이드바 (Sidebar.tsx)
- 배경 `var(--surface)` (또는 살짝 구분되게 `var(--surface-2)`), 우측 `1px solid var(--border)`.
- 활성 항목: 배경 `var(--accent-soft)`, 텍스트 `var(--accent-ink)`, 좌측 보더 `3px solid var(--accent)`.
- 비활성: 텍스트 `var(--text-muted)`, hover 시 배경 `var(--surface-2)` + 텍스트 `var(--text)`.
- 로고 "🌧️ 먹구름" 은 `var(--text-strong)`.

---

## 5. 적용 원칙 (자유도 가이드)

> **이 변환 패턴(인라인 hex → 토큰)은 반드시 일관되게 따르되, 시각적 디테일은 위 규칙 안에서 자유롭게 개선하세요.**

- **반드시 지킬 것**: 토큰 치환(§2,§3), 라이트 테마 전환, 살구 포인트, 둥근 모서리, 부드러운 그림자, `#fff` 문맥 구분(§3.2).
- **자유롭게 개선해도 되는 것**: hover/focus 마이크로 인터랙션, 여백 미세조정(단 8px 그리드 준수), 페이지 로드 시 staggered 등장 애니메이션, 카드 정렬/레이아웃 다듬기.
- 단, 새로운 색을 **즉흥적으로 hex 로 추가하지 말 것**. 필요하면 토큰에 먼저 정의하고 쓸 것.
- 이모지 아이콘은 일단 유지해도 무방하나, 가능하면 통일감 있게.

---

## 6. Before → After 예시

아래는 실제 코드 패턴을 어떻게 바꾸는지 보여주는 샘플입니다. **나머지 모든 파일을 이 방식과 동일하게** 처리하세요.

### 예시 A — Sidebar 활성 항목 (인라인 → 토큰)

**Before** (`Sidebar.tsx`):
```tsx
style={({ isActive }) => ({
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
  color: isActive ? '#fff' : '#aaa',
  background: isActive ? '#16213e' : 'transparent',
  borderLeft: isActive ? '3px solid #6c63ff' : '3px solid transparent',
  fontSize: 14,
  transition: 'background 0.15s, color 0.15s',
})}
```

**After**:
```tsx
style={({ isActive }) => ({
  display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
  padding: 'var(--sp-3) var(--sp-5)',
  color: isActive ? 'var(--accent-ink)' : 'var(--text-muted)',
  background: isActive ? 'var(--accent-soft)' : 'transparent',
  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
  fontSize: 'var(--fs-base)',
  fontWeight: isActive ? 'var(--fw-bold)' : 'var(--fw-medium)',
  transition: 'var(--transition)',
})}
```

### 예시 B — Primary 버튼 (전송 버튼)

**Before** (`Home.tsx`):
```tsx
style={{
  background: '#6c63ff', border: 'none', borderRadius: 24,
  padding: '12px 20px', color: '#fff', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1,
}}
```

**After**:
```tsx
style={{
  background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-pill)',
  padding: 'var(--sp-3) var(--sp-5)', color: 'var(--text-on-accent)',
  fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-bold)',
  boxShadow: 'var(--shadow-accent)',
  cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1,
  transition: 'var(--transition)',
}}
```

### 예시 C — 카드 (RestaurantCard)

**Before**:
```tsx
style={{
  background: isMenuOpen ? '#1e1e3a' : '#16213e',
  border: `1px solid ${isMenuOpen ? '#6c63ff' : '#2a2a4a'}`,
  borderRadius: 12, padding: 14,
  display: 'flex', flexDirection: 'column', gap: 4,
  transition: 'border-color 0.15s',
}}
```

**After**:
```tsx
style={{
  background: isMenuOpen ? 'var(--accent-soft)' : 'var(--surface)',
  border: `1px solid ${isMenuOpen ? 'var(--accent)' : 'var(--border)'}`,
  borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)',
  display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)',
  boxShadow: isMenuOpen ? 'var(--shadow-accent)' : 'var(--shadow-sm)',
  transition: 'var(--transition)',
}}
// + (선택) onMouseEnter/Leave 또는 CSS 클래스로 hover 시 translateY(-2px) & shadow-md
```

### 예시 D — 분류 태그 (보라 → 살구)

**Before**:
```tsx
style={{
  fontSize: 11, padding: '2px 8px', borderRadius: 10,
  background: '#2a2a4a', color: '#6c63ff', border: '1px solid #6c63ff33',
}}
```

**After**:
```tsx
style={{
  fontSize: 'var(--fs-xs)', padding: '2px var(--sp-2)', borderRadius: 'var(--radius-pill)',
  background: 'var(--accent-soft)', color: 'var(--accent-ink)',
  border: '1px solid transparent',
}}
```

### 예시 E — 앱 배경 / 본문 글자색 (라이트 전환의 핵심)

**Before** (`index.css`):
```css
body {
  background: #0f0f23;
  color: #fff;
}
```

**After** (`index.css`):
```css
@import './styles/tokens.css';

body {
  background:
    linear-gradient(180deg, var(--bg-sky) 0%, var(--bg) 38%) fixed;
  color: var(--text);
  font-family: var(--font-sans);
}
```
> ⚠️ 여기서 `color: #fff` → `var(--text)` 로 바뀌었으므로, 페이지 내부에서 텍스트를 `#fff` 로 명시하던 곳들이 이제 흰 배경 위 흰 글자가 됩니다. §3.2 대로 텍스트용 `#fff` 를 `var(--text)`/`var(--text-strong)` 으로 반드시 교체하세요.

---

## 7. 작업 후 셀프 체크리스트

- [ ] `src/styles/tokens.css` 생성 & `index.css`에서 import 됨
- [ ] App.css 의 Vite 템플릿 잔재 삭제됨
- [ ] `grep -rE "#[0-9a-fA-F]{3,8}" src/` 결과가 (거의) 0건 — 남은 hex 없음
- [ ] 흰 배경 위에 흰/연한 글자로 안 보이는 텍스트 없음 (§3.2)
- [ ] 보라색(`#6c63ff` 계열) 완전히 사라지고 살구색으로 통일됨
- [ ] 모든 카드에 둥근 모서리 + 부드러운 그림자 적용됨
- [ ] 캐릭터 이미지가 배경과 자연스럽게 어울림
- [ ] `npm run dev` 로 전 페이지 깨짐 없이 렌더됨
- [ ] 기능 로직(n8n/supabase/상태)은 변경되지 않음
