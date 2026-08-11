# RUNGAME — 랭킹 시스템이 있는 횡스크롤 러너

쿠키런 계열의 인게임 루프를 가진 웹 러너 게임. 자동으로 달리는 캐릭터를
점프/슬라이딩으로 조작해 장애물을 피하고 동전을 먹는다. 시간이 지날수록
속도가 빨라지고, 충돌하면 `거리 + 동전`으로 점수를 정산한다.

Vanilla JS + Canvas 2D. 빌드 도구도 번들러도 없다.

## 실행

ES Module은 `file://`에서 CORS 정책 때문에 동작하지 않는다. 반드시 정적 서버로 띄운다.

```bash
npx serve firebase_subject
# 또는
python3 -m http.server 8000 --directory firebase_subject
```

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

## 현재 구현 범위

**완료 — 백엔드 없이 동작하는 부분**

- 게임 루프 전체 (고정 타임스텝 1/60s)
- 플레이어 물리·상태(달리기/점프/슬라이딩), 히트박스 축소 판정
- 거리 기반 스포너 — 장애물 2종, 동전 3패턴(직선/아치/낮은 줄)
- 속도 곡선과 배치 밀도, 두 개의 난이도 축
- 화면 상태 기계: 메뉴 → 카운트다운 → 플레이 → 결과
- HUD, 결과 패널(점수 분해 표시), 리더보드 화면, 로그인/회원가입 모달
- 탭 비활성화 시 일시정지, 반응형 캔버스 스케일링

**미완 — 내일 Firebase로 교체할 부분**

`src/firebase/` 세 파일이 지금은 `localStorage` 기반 **스텁**이다.
UI와 화면 흐름을 그대로 검증할 수 있도록 실제와 동일한 시그니처를
유지하고 있어서, 내부 구현만 갈아끼우면 호출부(`src/ui/*`)는 손대지 않아도 된다.

| 파일 | 지금 | 내일 |
|---|---|---|
| `firebase/config.js` | 빈 설정 + `IS_CONFIGURED = false` | 콘솔 설정값 + `initializeApp` |
| `firebase/auth.js` | localStorage 계정 | Firebase Authentication |
| `firebase/scores.js` | localStorage 랭킹 | Firestore + `runTransaction` |

> ⚠️ 스텁은 비밀번호를 localStorage에 그대로 보관한다. UI 흐름 검증용
> 껍데기이며 Firebase 연결과 동시에 삭제된다. 실제 계정 정보를 넣지 말 것.

리더보드에는 렌더링 확인용 더미 5행이 시드되어 있다. 이것도 함께 사라진다.

### 내일 할 일

1. Firebase 콘솔에서 프로젝트 생성 → 웹 앱 등록
2. Authentication → Email/Password 제공자 활성화
3. Firestore 생성 후 `firestore.rules` 배포
4. `firebase/config.js`의 `firebaseConfig` 교체, `IS_CONFIGURED = true`
5. `auth.js` / `scores.js` 내부를 Firebase SDK 호출로 교체
6. 배포용 `firebase.json` 작성 (Firebase Hosting을 쓸 경우)

### 아이디/비밀번호 규칙 흡수

요구사항은 "규칙 없는 아이디·비밀번호"인데 Firebase Auth는 이메일 형식과
비밀번호 6자 이상을 강제한다. `config.js`에서 내부 변환으로 흡수한다.

```
toEmail(id)    → `${id.toLowerCase()}@runner.local`
toPassword(pw) → `${pw}::runner-pad::`
```

`PW_PAD`는 클라이언트 상수라 비밀이 아니다. 보안 강도를 올리는 장치가 아니라
Firebase의 길이 제약을 회피하기 위한 것이다.

아이디는 이메일 로컬파트로 유효한 범위(영문·숫자·`._-`)만 허용하며,
이건 사용자에게 노출되는 실질적 제약이므로 회원가입 폼에 안내를 띄운다.

## 수치 튜닝

모든 상수는 `src/game/config.js` 한 곳에 있고, `window.CONFIG`로 노출된다.
플레이 중 콘솔에서 바로 만질 수 있다.

```js
CONFIG.SPEED_ACCEL = 12     // 가속을 빠르게
CONFIG.TIGHTNESS_END = 0.6  // 후반 배치를 더 조이게
```

기준: 30초 이전에 반복 사망하면 `SPEED_ACCEL`을 낮추고, 90초 넘게
무피해로 달리면 `TIGHTNESS_END`를 조인다.

## 구조

```
firebase_subject/
├─ index.html            # 단일 진입점. 모든 화면을 DOM 섹션으로 포함
├─ firestore.rules       # 내일 배포
├─ styles/main.css
└─ src/
   ├─ main.js            # 부트스트랩, 화면 전환 오케스트레이션
   ├─ firebase/          # config · auth · scores  ← 지금은 스텁
   ├─ ui/                # screens · authModal · leaderboard · hud
   └─ game/              # config · input · player · spawner
                         # world · collision · renderer · game
```

`renderer.js`에만 `ctx`를 만지는 코드가 있다. 도형 프로토타입을
스프라이트로 바꿀 때 이 파일 하나만 고치면 되도록 렌더를 로직에서 분리했다.

**고정 타임스텝을 쓴 이유**: 가변 dt면 모니터 주사율(60/120/144Hz)에 따라
점프 높이와 난이도가 달라진다. 랭킹 게임에서는 타협할 수 없는 지점이라
모든 기기에서 동일한 기록이 나오도록 `1/60s`로 고정했다.
