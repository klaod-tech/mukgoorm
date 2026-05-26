# 노트북 작업 목록

> 이 파일은 노트북 환경에서 진행해야 할 n8n 관련 작업을 정리한 것입니다.
> 현재 PC에서는 설정해도 공유가 안 되기 때문에 노트북에서 직접 진행해야 합니다.

---

## 진행 현황 (2026-05-25 기준)

| 항목 | 상태 | 비고 |
|------|------|------|
| IMAP 읽기 Code 노드 추가 | ✅ 완료 | n8nV6.json에 포함 |
| EmailBOT 프롬프트 업데이트 | ✅ 완료 | `[실제 읽은 이메일]` 섹션 추가 |
| 웹훅 ID 유니크화 | ✅ 완료 | 이메일/식사/일기/일정/체중 재발급 |
| n8nV6.json 커밋 및 푸시 | ✅ 완료 | feat/web-migration 브랜치 |
| npm install (imap, mailparser) | ⬜ 노트북에서 | |
| NODE_FUNCTION_ALLOW_EXTERNAL 설정 | ⬜ 노트북에서 | |
| Credentials 등록 (기상청/카카오/Supabase/OpenAI) | ⬜ 노트북에서 | |
| 워크플로우 임포트 및 Active | ⬜ 노트북에서 | |
| 이메일 기능 테스트 | ⬜ 노트북에서 | |

---

## 배경

이 프로젝트는 React 웹앱 + n8n 워크플로우 + Supabase DB로 구성된 AI 먹구름 챗봇입니다.

- React에서 사용자가 채팅을 입력하면 n8n 웹훅으로 전달
- n8n이 의도를 분류해 날씨/식사/일기/일정/체중/이메일/음식추천 등을 처리
- 결과를 다시 React로 반환해 화면에 출력
- n8n 워크플로우 파일: `n8n/n8nV6.json` (최신)

---

## 작업 1 — API 키 Credentials 분리 (보안)

### 왜 해야 하는가

현재 n8n 워크플로우 JSON에 기상청 serviceKey와 카카오 API 키가 평문으로 하드코딩되어 있습니다.
Git에 올라가면 키가 그대로 노출되므로, n8n Credentials로 분리해야 합니다.
n8n Credentials는 인스턴스 DB에 암호화 저장되며 워크플로우 JSON에는 ID 참조만 포함됩니다.

### 기상청 API 키 등록

1. n8n 좌측 메뉴 → **Credentials** → **Add credential**
2. `HTTP Query Auth` 선택
3. 아래처럼 입력 후 Save

| 항목 | 값 |
|------|-----|
| Name | `기상청 API` |
| Name (Query param) | `serviceKey` |
| Value | `a385c25e408f49b8cf08e1de3c3284689da61dcde44fc15244c533b4bd65ca76` |

4. 아래 4개 노드 각각에 적용:
   - `초단기실황`
   - `최저최고기온`
   - `측정소`
   - `미세먼지`

   각 노드에서:
   - **Authentication** → `Predefined Credential Type`
   - `Credential Type` → `HTTP Query Auth`
   - `기상청 API` 선택
   - 기존 `serviceKey` 파라미터 항목 **삭제**

### 카카오 API 키 등록

1. **Add credential** → `HTTP Header Auth` 선택
2. 아래처럼 입력 후 Save

| 항목 | 값 |
|------|-----|
| Name | `카카오 API` |
| Name (Header) | `Authorization` |
| Value | `KakaoAK 7cc3ee0adc72765078ed6cfbd3c09541` |

3. `카카오 좌표` 노드에 적용:
   - **Authentication** → `Predefined Credential Type`
   - `HTTP Header Auth` → `카카오 API` 선택
   - 기존 `Authorization` 헤더 항목 **삭제**

---

## 작업 2 — EmailBOT 실제 이메일 읽기 연결

### 왜 해야 하는가

현재 EmailBOT은 Supabase에서 유저의 이메일 주소·앱 비밀번호를 가져오지만,
이를 GPT 프롬프트에 텍스트로만 전달합니다. GPT는 이메일 서버에 실제 접속할 수 없으므로
이메일을 읽지 못합니다.

유저마다 이메일 계정이 다르기 때문에 n8n 기본 IMAP 노드(정적 Credentials)로는 처리 불가합니다.
Code 노드에서 동적으로 연결해야 합니다.

### Step 1 — 패키지 설치

터미널에서 실행:
```bash
npm install -g imap mailparser
```

### Step 2 — 환경변수 설정 후 n8n 재시작

n8n 실행 시 아래처럼 환경변수를 추가합니다:
```bash
NODE_FUNCTION_ALLOW_EXTERNAL=imap,mailparser n8n start
```

`.env` 파일을 사용하는 경우 아래 한 줄 추가:
```
NODE_FUNCTION_ALLOW_EXTERNAL=imap,mailparser
```

### Step 3 — n8n 워크플로우 수정 ✅ 완료 (n8nV6.json에 포함)

`음식 추천 v2` 워크플로우에서 `Edit Fields1` → `EmailBOT` 사이에 **Code 노드** 추가.

Code 노드 내용:
```js
const Imap = require('imap');
const { simpleParser } = require('mailparser');

const provider = $('Edit Fields1').item.json.email_provider;
const address  = $('Edit Fields1').item.json.email_address;
const password = $('Edit Fields1').item.json.email_app_pw;

const hostMap = {
  naver: 'imap.naver.com',
  gmail: 'imap.gmail.com',
};
const host = hostMap[provider] ?? 'imap.naver.com';

return new Promise((resolve, reject) => {
  const imap = new Imap({ user: address, password, host, port: 993, tls: true });
  const mails = [];

  imap.once('ready', () => {
    imap.openBox('INBOX', true, (err) => {
      if (err) { imap.end(); return reject(err); }

      imap.search(['UNSEEN'], (err, uids) => {
        if (err || !uids.length) {
          imap.end();
          return resolve([{ json: { mails: [] } }]);
        }

        const recent = uids.slice(-5);
        const f = imap.fetch(recent, { bodies: '' });

        f.on('message', msg => {
          msg.on('body', stream => {
            simpleParser(stream, (err, parsed) => {
              if (!err) mails.push({
                from:    parsed.from?.text ?? '',
                subject: parsed.subject ?? '',
                text:    (parsed.text ?? '').slice(0, 300),
              });
            });
          });
        });

        f.once('end', () => imap.end());
      });
    });
  });

  imap.once('end',   () => resolve([{ json: { mails } }]));
  imap.once('error', reject);
  imap.connect();
});
```

### Step 4 — EmailBOT 프롬프트 수정 ✅ 완료 (n8nV6.json에 포함)

기존 EmailBOT 프롬프트 상단에 아래 내용 추가:
```
[실제 읽은 이메일]
{{ $('Code').item.json.mails.length > 0
  ? $('Code').item.json.mails.map((m, i) =>
      `[${i+1}] 발신: ${m.from} | 제목: ${m.subject}\n내용: ${m.text}`
    ).join('\n\n')
  : '읽지 않은 이메일이 없습니다.'
}}
```

### 주의 — 네이버 메일 IMAP 활성화

네이버 메일 사용 시 IMAP이 꺼져있으면 연결 실패합니다.
- 네이버 메일 → 환경설정 → POP3/IMAP 설정 → **IMAP 사용함** 체크

---

## 작업 3 — Railway 배포 시 추가 작업 (나중에)

노트북에서 n8n을 Railway로 이전할 때 아래 작업이 추가로 필요합니다.

### Dockerfile 생성

프로젝트 루트에 `Dockerfile` 생성:
```dockerfile
FROM n8nio/n8n:latest
USER root
RUN npm install -g imap mailparser
USER node
```

Railway가 이 파일을 자동 감지해 커스텀 이미지로 빌드합니다.

### Railway 환경변수 설정

Railway 프로젝트 → **Variables** 탭에서 추가:

| Key | Value |
|-----|-------|
| `NODE_FUNCTION_ALLOW_EXTERNAL` | `imap,mailparser` |
| `N8N_HOST` | Railway에서 발급된 도메인 |
| `WEBHOOK_URL` | `https://{Railway 도메인}/` |

### Credentials 재등록

n8n Credentials는 인스턴스 DB에 저장되므로 Railway 배포 후 아래를 다시 등록해야 합니다:
- 기상청 API (HTTP Query Auth)
- 카카오 API (HTTP Header Auth)
- Supabase account
- OpenAI account

---

## 완료 체크리스트

### 현재 PC — 완료
- [x] Code 노드 추가 (Edit Fields1 → IMAP 읽기 → EmailBOT)
- [x] EmailBOT 프롬프트 수정 (`[실제 읽은 이메일]` 섹션 추가)
- [x] 웹훅 ID 유니크화 (이메일/식사/일기/일정/체중)
- [x] n8nV6.json 커밋 및 푸시

### 노트북 — 미완료
- [ ] `npm install -g imap mailparser` 실행
- [ ] `NODE_FUNCTION_ALLOW_EXTERNAL` 환경변수 설정
- [ ] n8n 재시작 확인
- [ ] `n8n/n8nV6.json` 임포트
- [ ] 기상청 API Credentials 생성 및 4개 노드 적용
- [ ] 카카오 API Credentials 생성 및 카카오 좌표 노드 적용
- [ ] Supabase Credentials 등록
- [ ] OpenAI Credentials 등록
- [ ] 워크플로우 Active 설정
- [ ] 네이버 메일 IMAP 활성화 확인
- [ ] 이메일 기능 테스트
