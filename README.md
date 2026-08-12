# RUNGAME — 랭킹 시스템이 있는 횡스크롤 러너

쿠키런 계열의 인게임 루프를 가진 웹 러너 게임. 자동으로 달리는 캐릭터를
점프/슬라이딩으로 조작해 장애물을 피하고 동전을 먹는다. 시간이 지날수록
속도가 빨라지고, 충돌하면 `거리 + 동전`으로 점수를 정산해 서버에 저장한다.

프런트엔드는 Vanilla JS + Canvas 2D, 백엔드는 Cloudflare Workers + D1.
빌드 도구도 번들러도 프레임워크도 없다.

## 아키텍처

Worker 하나가 정적 자산과 API를 **같은 오리진**에서 서빙한다.
프런트와 API가 분리되어 있지 않으므로 CORS 설정이 아예 필요 없고,
배포도 `wrangler deploy` 한 번으로 끝난다.

```
브라우저
   │
   ├── /              → assets 바인딩이 public/ 을 그대로 서빙
   └── /api/*         → worker/index.js
                          ├── 인증  (PBKDF2 + HMAC 서명 세션 쿠키)
                          └── 랭킹  → D1 (SQLite)
```

| 구성 요소 | 선택 | 이유 |
|---|---|---|
| 호스팅 + API | Workers (Static Assets) | 프런트·API 동일 오리진. 별도 호스팅 불필요 |
| DB | D1 (SQLite) | `ORDER BY best_score DESC` 한 방으로 랭킹이 끝난다 |
| 인증 | 자체 구현 | Cloudflare에 Firebase Auth 같은 관리형 서비스가 없다 |
| 세션 | HMAC 서명 토큰 | 서버가 상태를 갖지 않아 어느 엣지에서든 동일 동작 |

## 로컬 실행

```bash
npm install
npm run db:local     # 로컬 D1에 스키마 적용 (최초 1회)
npm run dev          # http://127.0.0.1:8787
```

`wrangler dev`는 로컬 SQLite를 쓰므로 Cloudflare 계정 없이도 전부 돌아간다.

## 배포

브랜치에 push하면 `.github/workflows/deploy.yml`이 알아서 배포한다.
수동 조작이 필요한 단계는 없다.

필요한 저장소 Actions 시크릿은 두 개다.

| 시크릿 | 용도 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers·D1 편집 권한이 있는 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | 계정 ID |

워크플로우가 순서대로 하는 일:

1. D1 `rungame`을 찾고, 없으면 만든다 (몇 번 돌려도 안전)
2. 찾은 `database_id`를 `wrangler.jsonc`에 주입 — 러너의 체크아웃에만
   적용되며 저장소에는 커밋하지 않는다
3. `schema.sql` 적용 (전부 `IF NOT EXISTS`라 매번 돌려도 무해)
4. `wrangler deploy`
5. `SESSION_SECRET` 보장 — 없을 때만 랜덤 생성하고, 이미 있으면 건드리지 않는다
6. 배포된 주소로 스모크 테스트

`SESSION_SECRET`을 직접 정하고 싶으면 같은 이름의 저장소 시크릿을 추가하면
그 값이 우선한다.

> **키를 바꾸면 로그인된 모든 세션이 무효가 된다.** 그래서 워크플로우는
> 기존 시크릿 목록을 확인하지 못하면 임의로 덮어쓰지 않고 그 자리에서
> 실패한다.

로컬에서 직접 배포하려면 `npx wrangler login` 후 위 과정을 손으로 하면 된다.

### SESSION_SECRET이 없으면 어떻게 되나

**프로덕션에서는 인증이 아예 동작하지 않는다.** 로그인·회원가입이 503을
반환한다.

고정 기본값으로 폴백하면 그 값이 이 저장소에 적혀 있으므로 누구나 세션을
위조할 수 있다. 조용히 뚫리느니 눈에 띄게 고장나는 편이 낫다고 판단했다.
`localhost`에서만 고정값을 쓴다.

## 조작

| 입력 | 동작 |
|---|---|
| `Space` / `↑` / `W` | 점프 (지상에서만, 2단 점프 없음) |
| `Shift` / `↓` / `S` | 슬라이딩 (누르는 동안 유지, 최소 0.25초) |

조작감 보정 두 가지가 들어 있다. 없으면 "분명 눌렀는데 안 뛰었다"는 체감이 생긴다.

- **코요테 타임 80ms** — 발판에서 떨어진 직후에도 점프 허용
- **점프 버퍼 100ms** — 착지 직전에 누른 점프를 착지 순간에 발동

추가로, 막대 아래에서 시프트를 떼도 머리 위에 공간이 없으면 슬라이딩을
유지한다 (억울한 죽음 방지).

## 아이디 / 비밀번호

**규칙이 거의 없다.** 한글 아이디도, 1글자 비밀번호도 된다.

Firebase Auth를 쓸 때는 이메일 형식과 비밀번호 6자 이상이 강제돼서
`id@runner.local` 변환과 `PW_PAD` 접미사로 우회해야 했다. 계정을 직접
저장하는 지금은 그 우회가 통째로 필요 없어졌고, 요구사항이던
"규칙 없는 아이디·비밀번호"를 그대로 만족한다.

남은 제약은 두 가지뿐이며 둘 다 이유가 있다.

- 아이디 2~20자, 공백·제어문자 불가 — 앞뒤 공백으로 남을 사칭할 수 있어서
- 아이디 중복은 대소문자 무시 — `Runner`와 `runner`가 별개 계정이 되면 헷갈린다.
  표시는 가입할 때 쓴 원본 그대로 나온다.

### 비밀번호 저장

PBKDF2-SHA256, 계정마다 랜덤 16바이트 salt, 100,000회 반복.
원문은 어디에도 저장하지 않는다. 검증은 상수 시간 비교라 타이밍으로
정보가 새지 않는다.

세션은 `userId.만료시각`을 HMAC-SHA256으로 서명한 토큰이며
`HttpOnly` + `SameSite=Strict` 쿠키로 나간다. `HttpOnly`라서 XSS가
생겨도 자바스크립트가 토큰을 읽어갈 수 없다.

## 치팅에 대한 한계

솔직하게 적어 둔다. 점수를 **클라이언트가 계산해 전송하는 구조**라,
개발자 도구로 임의의 점수를 올리는 것은 막을 수 없다.

서버가 하는 검사는 여기까지다.

- `score === meters + coins × 10` 재계산
- 음수·상한(1,000,000) 검사
- 최고 기록 갱신은 `UPSERT ... WHERE excluded.best_score > best_score`
  단일 문장으로 처리 — 동시 제출에도 낮은 점수가 높은 기록을 덮지 못한다

완전한 방어는 입력 리플레이를 서버에서 재시뮬레이션해야 하며,
이 과제의 범위 밖으로 둔다.

## API

모두 같은 오리진. 인증은 세션 쿠키가 자동으로 실린다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/signup` | `{id, password}` → 가입 + 로그인 |
| POST | `/api/auth/signin` | `{id, password}` |
| POST | `/api/auth/signout` | 쿠키 만료 |
| GET | `/api/auth/me` | `{user}` — 새로고침 시 세션 복원용 |
| POST | `/api/scores` | `{score, coins, meters}` → `{saved, isBest, bestScore}` |
| GET | `/api/leaderboard?limit=100` | `{rows}` — 공개, 로그인 불필요 |

## 수치 튜닝

모든 상수는 `public/src/game/config.js` 한 곳에 있고 `window.CONFIG`로
노출된다. 플레이 중 콘솔에서 바로 만질 수 있다.

```js
CONFIG.SPEED_ACCEL = 12     // 가속을 빠르게
CONFIG.TIGHTNESS_END = 0.6  // 후반 배치를 더 조이게
```

기준: 30초 이전에 반복 사망하면 `SPEED_ACCEL`을 낮추고, 90초 넘게
무피해로 달리면 `TIGHTNESS_END`를 조인다.

> `COIN_VALUE`는 클라이언트와 `worker/index.js` 양쪽에 있다. 서버가 점수를
> 재계산해 검증하므로 **한쪽만 바꾸면 모든 점수 제출이 400으로 거부된다.**

## 구조

```
├─ wrangler.jsonc          # Worker + assets + D1 바인딩
├─ schema.sql              # D1 스키마
├─ worker/
│  ├─ index.js             # 라우팅, 인증, 점수 검증, 랭킹 쿼리
│  └─ crypto.js            # PBKDF2 해싱, 세션 서명 (WebCrypto만 사용)
└─ public/                 # 정적 자산 — 그대로 서빙된다
   ├─ index.html
   ├─ styles/main.css
   └─ src/
      ├─ main.js           # 부트스트랩, 화면 전환 오케스트레이션
      ├─ api/              # client · auth · scores  ← Worker 호출
      ├─ ui/               # screens · authModal · leaderboard · hud
      └─ game/             # config · input · player · spawner
                           # world · collision · renderer · game
```

`renderer.js`에만 `ctx`를 만지는 코드가 있다. 도형 프로토타입을
스프라이트로 바꿀 때 이 파일 하나만 고치면 되도록 렌더를 로직에서 분리했다.

**고정 타임스텝을 쓴 이유**: 가변 dt면 모니터 주사율(60/120/144Hz)에 따라
점프 높이와 난이도가 달라진다. 랭킹 게임에서는 타협할 수 없는 지점이라
모든 기기에서 동일한 기록이 나오도록 `1/60s`로 고정했다.
