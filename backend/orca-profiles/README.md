# 오르카 슬라이서 견적 기준 설정

실시간 견적을 오르카 슬라이서로 계산할 때(`QUOTE_SLICER=orca`) 쓰는 설정입니다.
모델을 이 설정으로 슬라이싱해서 나온 출력 시간이 견적 금액의 바탕이 됩니다.

| 파일 | 오르카의 프로필 이름 |
|---|---|
| `machine.json` | Prusa XL 0.4 nozzle (출력 크기 360 x 360 x 360mm) |
| `process.json` | 0.20mm Structural @Prusa XL 0.4 (층 높이 0.2mm, 채움 15%, 벽 2겹, 서포트 없음) |
| `PLA.json` | Prusament PLA @XL |
| `PETG.json` | Prusament PETG @XL |
| `ABS.json` | Generic ABS @Prusa XL |
| `TPU.json` | Generic TPU @Prusa (XL 전용 TPU 프로필이 없어 공용 프로필 사용) |

## 출처

[OrcaSlicer](https://github.com/OrcaSlicer/OrcaSlicer) v2.5.2 의 `resources/profiles/Prusa` 에 있는 프로필을,
부모 설정(`inherits`)까지 한 파일로 합친 것입니다. 값은 바꾸지 않았습니다. OrcaSlicer 는 AGPL-3.0 라이선스입니다.

## 바꾸는 방법

손으로 고치지 말고 `backend/scripts/make-orca-profiles.mjs` 의 프로필 이름을 바꾼 뒤 다시 만듭니다.

```bash
node backend/scripts/make-orca-profiles.mjs
```

채움 비율이나 속도처럼 값 하나만 바꾸고 싶으면 `process.json` 의 해당 항목을 고쳐도 됩니다.
어느 쪽이든 **견적 금액이 달라지므로**, 바꾼 뒤에는 같은 모델로 금액을 비교해 보고 배포하세요.
