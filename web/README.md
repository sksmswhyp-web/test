# lofi.room 웹앱

빌드 없이 바로 올리는 정적 사이트입니다 (`index.html` + `app.js`).
라이브러리(three.js 0.147, supabase-js 2.45)는 jsDelivr에서, 유튜브 플레이어는 YouTube IFrame API로 불러옵니다.
서버는 Supabase `free` 프로젝트의 `lr_` 테이블을 씁니다 (`../docs/backend.md`).

- 주소 뒤에 `#/@아이디`를 붙이면 그 사람의 방으로 갑니다.
- 조작: WASD/방향키 걷기, E 앉기·일어나기, Enter 채팅, 마우스 드래그 회전.
