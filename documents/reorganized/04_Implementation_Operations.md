# 04. 구현 및 운영 (Implementation & Operations)

본 문서는 실제 시스템 구축 및 안정적인 운영을 위한 가이드를 정의합니다. 상세 가이드는 하위 문서를 참조하십시오.

## 1. 개발 및 최적화 가이드 [상세 보기 (08)](./08_Performance_Optimization_Guide.md)
*   **Java 17+ (ZGC):** `-XX:+UseZGC` 및 `-XX:MaxGCPauseMillis=1` 설정을 통해 1ms 미만의 GC 지연 달성.
*   **OS/Kernel Tuning:**
    *   `net.ipv4.tcp_low_latency=1`, `net.ipv4.tcp_nodelay=1` 설정을 통한 네트워크 지연 최소화.
    *   `taskset` 및 `numactl`을 사용한 CPU Affinity 고정.
*   **바이너리 프로토콜:** Netty와 SBE(Simple Binary Encoding)를 결합한 초고속 데이터 전송. [상세 보기 (09)](./09_WebSocket_WebGL_Tech_Detail.md)

## 2. 배포 및 인프라 [상세 보기 (07)](./07_Infrastructure_Docker_Compose.md)
*   **Docker Compose:** 개발 및 데모 환경 구성을 위한 완전한 `docker-compose.yml` 제공.
*   **Kubernetes (Helm/Argo CD):** 상용 환경에서의 자동 복구 및 심볼별 매칭 엔진 배포 전략.
*   **Resource Limits:** 엔진 및 중요 어댑터에 대한 명시적인 CPU/Memory 할당.

## 3. 프론트엔드 최적화
*   **WebGL Rendering:** DOM 대신 GPU 가속을 활용하여 수만 개의 가격 레벨을 60fps로 렌더링.
*   **Binary Decoding:** `DataView`를 활용하여 브라우저에서 바이너리 메시지를 즉시 파싱.

## 4. 보안 및 리스크 관리
*   **Risk Module:** 가격 밴드(Price Band), 주문 속도 제한(Rate Limit), 변동성 완화 장치(Halt) 구현.
*   **Audit Logging:** 모든 이벤트를 변경 불가능한(Append-only) 형태로 저장하여 규제 대응 및 정합성 검증.
*   **Chaos Engineering:** Kafka 장애, 엔진 강제 종료 등의 시나리오를 통한 복구 정합성 확인.

