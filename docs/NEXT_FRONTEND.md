# 프론트엔드 다음 개선 사항

## 🔴 버그 수정

### 1. 회원탈퇴 시 Auth 유저 미삭제
**현상**: 회원탈퇴 후 동일 계정으로 재로그인 가능. `users` 테이블 row는 삭제되지만 Supabase Auth 유저가 남아 있어 같은 이메일/비밀번호로 재가입 없이 로그인됨.

**원인**: 클라이언트에서 `auth.admin.deleteUser()`를 호출하려면 service role key가 필요한데, 프론트엔드에 노출 불가.

**해결 방법**: Supabase Edge Function 생성
```
supabase/functions/delete-user/index.ts
  → auth.admin.deleteUser(user_id) 호출
  → service role key는 Edge Function 환경변수로 관리
```
`handleDeleteAccount` (Settings.tsx)에서 Edge Function을 호출하도록 수정.

---

### 2. evoState 초기값 오류
**파일**: [web/src/pages/Home.tsx](../web/src/pages/Home.tsx)

**현상**: 앱 로드 시 캐릭터 진화 상태 체크를 건너뜀. 진화 여부를 확인하기 전에 `'evolved'`로 시작해 조건 분기가 틀어짐.

**원인**: `evoState` 초기값이 `'evolved'`로 설정되어 있음.

**수정**: 초기값을 `'checking'`으로 변경.
```ts
// 현재
const [evoState, setEvoState] = useState<'checking' | 'evolving' | 'evolved'>('evolved')

// 수정
const [evoState, setEvoState] = useState<'checking' | 'evolving' | 'evolved'>('checking')
```

---

### 3. Worldcup.tsx 셔플 편향
**파일**: [web/src/pages/Worldcup.tsx](../web/src/pages/Worldcup.tsx)

**현상**: 음식 월드컵 대진 순서가 무작위처럼 보이지만 실제로는 편향 있음.

**원인**: Fisher-Yates 알고리즘 미적용. 현재 `sort(() => Math.random() - 0.5)` 방식은 통계적으로 균등하지 않음.

**수정**:
```ts
function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

---

### 4. email_app_pw 보안 취약점
**파일**: [web/src/hooks/useUser.ts](../web/src/hooks/useUser.ts) (42번째 줄 근처)

**현상**: 이메일 앱 비밀번호가 sessionStorage에 평문으로 저장됨. XSS 공격 시 탈취 가능.

**수정 방향**: sessionStorage에서 제거하고 필요 시 Supabase에서 직접 조회하거나, 입력 시에만 메모리에 유지.

---

## 🟡 나중에 구현

### 2. 로그인 세션 유지 (자동 로그인)
**현재**: `persistSession: false` — 탭 닫으면 로그아웃됨 (의도된 동작).
**향후**: 온보딩 흐름 안정화 후 `persistSession: true`로 변경하여 재방문 시 자동 로그인 구현.
단, 활성화 전 온보딩 리다이렉트 로직 충분히 검증 필요.

---

### 3. BOT_TIMEOUT 데드코드 정리
**파일**: [web/src/lib/n8n.ts](../web/src/lib/n8n.ts)

**현상**: `BOT_TIMEOUT`이 빈 객체로 선언되어 있어 항상 `DEFAULT_TIMEOUT(15000ms)`만 사용됨. 봇별 타임아웃 조정이 실질적으로 불가능한 상태.

**수정 방향**: 봇별 타임아웃이 필요 없으면 `BOT_TIMEOUT` 변수 제거하고 `DEFAULT_TIMEOUT`만 사용.
```ts
// 제거 대상
const BOT_TIMEOUT: Record<string, number> = {}

// axios 호출부도 단순화
{ timeout: DEFAULT_TIMEOUT }
```