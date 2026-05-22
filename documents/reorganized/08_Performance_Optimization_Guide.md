# 08. 성능 최적화 가이드 (Performance Optimization Guide)

본 문서는 실거래소 수준의 초저지연(p99 < 5ms)을 달성하기 위한 JVM, 커널, 하드웨어 튜닝 및 최적화 설정값을 상세히 설명합니다.

## 1. Java ZGC 및 JVM 튜닝
가비지 컬렉션(GC)에 의한 중단 시간(Pause)을 최소화하기 위해 Java 17 이상의 ZGC를 필수적으로 사용합니다.

*   **ZGC 핵심 옵션:**
    *   `-XX:+UseZGC`: ZGC 활성화.
    *   `-XX:MaxGCPauseMillis=1`: 최대 GC 중단 시간을 1ms로 제한.
    *   `-XX:+AlwaysPreTouch`: 시작 시 모든 메모리를 할당하여 런타임 지연 방지.
    *   `-Xms / -Xmx`: 힙 메모리 크기를 동일하게 고정하여 크기 조정 오버헤드 제거.

```bash
# 매칭 엔진 실행을 위한 권장 JVM 옵션
java -XX:+UseZGC \
     -XX:MaxGCPauseMillis=1 \
     -XX:+AlwaysPreTouch \
     -XX:+UnlockExperimentalVMOptions \
     -XX:ZUncommitDelay=300 \
     -Xms4G -Xmx4G \
     -jar matching-engine.jar
```

## 2. Linux 커널 튜닝 (sysctl)
네트워크 스택의 지연 시간을 줄이고 대규모 동시 접속 처리를 위한 커널 파라미터 최적화입니다.

```bash
# TCP 지연 방지 및 백로그 증가
sysctl -w net.core.netdev_max_backlog=250000
sysctl -w net.core.somaxconn=65535
sysctl -w net.ipv4.tcp_low_latency=1
sysctl -w net.ipv4.tcp_nodelay=1
sysctl -w net.ipv4.tcp_fin_timeout=5
sysctl -w net.ipv4.tcp_tw_reuse=1
```

*   **net.ipv4.tcp_low_latency:** 처리량보다 응답 속도를 우선하도록 설정.
*   **net.ipv4.tcp_nodelay:** Nagle 알고리즘을 비활성화하여 패킷을 즉시 전송.

## 3. CPU Affinity 및 NUMA 최적화
핵심 매칭 엔진 스레드가 특정 CPU 코어에서만 실행되도록 고정하여 컨텍스트 스위칭 및 캐시 미스를 방지합니다.

*   **taskset 활용:**
```bash
# 2~5번 코어를 매칭 엔진 전용으로 할당
taskset -c 2-5 java -jar matching-engine.jar
```

*   **smp_affinity (NIC IRQ 분리):**
네트워크 인터페이스 카드(NIC)의 인터럽트 처리가 매칭 엔진 코어와 겹치지 않도록 분리합니다.
```bash
# NIC IRQ를 4번 코어에 할당 (엔진 코어와 분리)
echo 4 > /proc/irq/<irq_number>/smp_affinity
```

*   **NUMA 제어:**
```bash
# 0번 NUMA 노드에 바인딩하여 메모리 접근 지연 최소화
numactl --cpunodebind=0 --membind=0 java -jar matching-engine.jar
```

## 4. 메모리 레이아웃 최적화 (Off-Heap)
수백만 건의 주문을 유지할 때 GC의 영향을 완전히 피하기 위해 `ByteBuffer`나 `Unsafe`를 활용한 Off-Heap 메모리 관리를 적용합니다.

*   **Price Level Aggregation:** UI용 데이터 생성 시 개별 주문이 아닌 가격대별 총량(Price Level)만 관리하여 객체 생성을 최소화합니다.
*   **Zero-Copy:** Netty의 `DirectBuffer`를 사용하여 커널과 유저 공간 사이의 복사 없는 데이터 전송을 구현합니다.

## 5. 성능 측정 및 벤치마크
*   **Latency 측정:** 엔진 입구와 출구에 나노초 단위 타임스탬프를 찍어 p50, p95, p99 지연 시간을 추적합니다.
*   **Flame Graphs:** `async-profiler`를 사용하여 핫스팟 메서드를 시각화하고 최적화합니다.
