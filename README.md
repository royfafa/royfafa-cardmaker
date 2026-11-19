# 로이파파 카드메이커 (royfafa-cardmaker)

스마트폰 브라우저에서 바로 쓰는 **인스타그램 카드뉴스 · 9:16 숏폼 영상 제작 도구**입니다.
설치·로그인·백엔드 없이 정적 파일만으로 동작하며, GitHub Pages에서 바로 열립니다.

- 기본 핸들: `@royfafa2023` / `로이파파` (설정 탭에서 변경 가능)
- 카드 이미지: **1080 × 1350 (4:5)** PNG
- 숏폼 영상: **1080 × 1920 (9:16)**
- 저장: 브라우저 `localStorage` (서버 업로드 없음)

> 이 저장소에는 개인정보·API 키·샘플 개인 데이터가 들어 있지 않습니다. 모든 기본값은 위 브랜드 핸들뿐입니다.

---

## 주요 기능

### 1. 원고 (2가지 모드)
- **무료 원고 붙여넣기 모드 (API 키 0원)**
  - 샘플 프리셋 2종 1탭 불러오기 (`AI 활용 팁`, `일상·절약 체크리스트`)
  - 일반 텍스트 붙여넣기: **빈 줄로 슬라이드 구분, 각 블록의 첫 줄이 소제목**, `-`로 시작하는 줄은 도식 항목
  - JSON 붙여넣기: 아래 스키마를 자동 인식
  - **"클로드·포리용 프롬프트 복사"**: 다른 AI 채팅에 붙여넣어 JSON 원고를 받아 오는 용도
- **Claude API 자동 생성 모드**
  - 주제·참고 메모 입력 → 후킹 3안 + 카드 4~6장 + 캡션/해시태그를 JSON으로 생성
  - 모델 선택(`claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-opus-4-1`) 또는 모델 ID 직접 입력
  - 브라우저에서 `https://api.anthropic.com/v1/messages` 직접 호출
    (`anthropic-dangerous-direct-browser-access: true` 헤더 사용)

```json
{
  "title": "표지 제목",
  "hooks": [
    { "type": "호기심형", "line1": "첫째 줄", "line2": "강조 둘째 줄" },
    { "type": "반전형", "line1": "첫째 줄", "line2": "강조 둘째 줄" },
    { "type": "핵심형", "line1": "첫째 줄", "line2": "강조 둘째 줄" }
  ],
  "cards": [
    { "subtitle": "소제목", "body": "본문 1~2문장", "items": ["도식 항목1", "도식 항목2"] }
  ],
  "caption": "인스타 캡션",
  "hashtags": ["#카드뉴스", "#정보"]
}
```

### 2. 훅 고르기
- `1. 호기심형`, `2. 반전형`, `3. 핵심형` 두 줄 후킹 3종
- 카드를 한 번 누르면 `01 표지` 제목에 즉시 반영, 문구는 그 자리에서 수정

### 3. 카드 편집 (1080×1350 Canvas)
- `document.fonts.ready` 대기 후 **Pretendard**로 렌더링 (없으면 `Noto Sans KR` → 시스템 폰트)
- 한국어 **어절 단위 줄바꿈**과 자동 크기 축소로 넘침 방지
- 양식 3종
  1. **사진형** — 상단 사진 + 하단 페이드 + 검정 바탕 본문
  2. **설명 도식형** — `01`, `02`, `03` 번호 배지 인포그래픽
  3. **글 중심형** — 딥 다크 배경 + 강조색 소제목 + 넉넉한 여백
- 강조색 4종: 다크민트 `#52E5B7` · 다크앰버 `#FFB030` · 노란색 `#FACC15` · 스카이블루 `#38BDF8`
  (표지 둘째 줄, 본문 소제목·배지, 마지막 장 계정 CTA에 일괄 적용)
- 사진: 갤러리 파일 선택 / 이미지 URL / 밝기 / 위치(크롭 초점) / 제거
  - 외부 URL이 CORS로 막히면 안내 메시지를 띄우고 저장을 막지 않도록 갤러리 사진을 권장
- 슬라이드: 썸네일 스트립, 카드 추가·삭제·순서 이동, 카드별 소제목/본문/도식 항목 편집,
  마지막 장 핸들·CTA 문구 편집, 인스타 캡션 보기·원클릭 복사

### 4. 저장 · 영상
- **PNG 1080×1350**: 현재 카드 / 전체 카드 한 장씩 / 전체 ZIP(JSZip CDN, 실패 시 개별 저장으로 자동 대체)
- **9:16 숏폼 1080×1920**
  - 슬라이드당 2초 / 3초 / 4초
  - 전환: 부드러운 페이드 / 슬라이드 / 없음
  - 배경음악 파일 선택(Web Audio API로 페이드인·페이드아웃 믹싱, 미선택 시 무음)
  - 미리보기 재생 → `canvas.captureStream(30)` + `MediaRecorder`로 실제 녹화
  - **저장 포맷은 브라우저가 실제 지원하는 코덱을 `MediaRecorder.isTypeSupported`로 확인해 결정**하며,
    파일 확장자도 실제 `MediaRecorder.mimeType`에서 뽑습니다. 지원하지 않는 포맷을 `.mp4`로 속여 저장하지 않습니다.

### 저장함 · 설정
- 저장함: `localStorage` 기반 프로젝트 저장 / 불러오기 / 복제 / 삭제
- 설정: Claude API 키(이 브라우저에만 저장, 서버 전송 없음) + 테스트 호출,
  기본 핸들·서브타이틀·기본 양식·기본 강조색

---

## 사용 순서 (모바일)

1. `1. 원고` — 샘플을 누르거나, 다른 AI에게 받은 원고/JSON을 붙여넣고 **카드로 만들기**
2. `2. 훅 고르기` — 마음에 드는 후킹을 눌러 표지 제목 확정
3. `3. 카드 편집` — 양식·강조색 선택, 사진 넣기, 문구 다듬기
4. `4. 저장·영상` — PNG 저장(개별/ZIP) 또는 숏폼 영상 만들기

---

## 개인정보 · 보안

- 공개 저장소이므로 이 프로젝트에는 **실명, 직업, 근무지, 거주지, 가족 정보, 개인 이메일·전화번호, API 키**를 넣지 않았습니다.
- API 키는 사용자가 설정 탭에서 입력할 때만 `localStorage`에 저장되며, `api.anthropic.com` 외 어디로도 전송되지 않습니다.
- 브라우저에서 직접 API를 호출하는 방식이므로, **공용 기기에서는 키를 저장하지 마세요.** 키를 아는 사람은 그대로 사용할 수 있습니다.
- 프로젝트 데이터(사진 포함)는 사용자의 브라우저에만 남습니다. 저장 공간이 부족하면 사진 수를 줄이거나 저장함을 정리하세요.

---

## 파일 구조

```
index.html              화면 구조 (4단계 + 저장함/설정)
styles.css              모바일 우선 다크 UI
app.js                  상태·캔버스 렌더러·파서·내보내기·영상
manifest.webmanifest    PWA 매니페스트
icon.svg / icon-*.png   앱 아이콘
README.md
```

외부 의존성은 CDN 2개뿐이며, 둘 다 실패해도 앱이 멈추지 않습니다.
- Pretendard 웹폰트 (jsDelivr) → 실패 시 `Noto Sans KR`/시스템 폰트로 대체
- JSZip (jsDelivr) → 실패 시 ZIP 대신 개별 PNG 저장으로 안내

## GitHub Pages 배포

정적 파일이므로 `main` 브랜치 루트를 그대로 올리면 됩니다.

```bash
gh repo create <owner>/royfafa-cardmaker --public \
  --description "Mobile-first Instagram card news & 9:16 short-form video maker"
git init -b main && git add . && git commit -m "feat: 로이파파 카드메이커 초기 버전"
git remote add origin https://github.com/<owner>/royfafa-cardmaker.git
git push -u origin main
gh api repos/<owner>/royfafa-cardmaker/pages -X POST \
  -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'
```

배포 주소 예시: `https://<owner>.github.io/royfafa-cardmaker/`

## 브라우저 지원

- **Chrome / Edge / Samsung Internet**: PNG·MP4 또는 WebM 녹화 모두 대체로 지원
- **Safari(iOS)**: PNG·MP4 녹화 지원, 백그라운드 탭에서는 프레임이 느려질 수 있음
- 영상 녹화는 화면을 벗어나지 말고 재생 시간 동안 탭을 유지해야 합니다.

## 라이선스

MIT
