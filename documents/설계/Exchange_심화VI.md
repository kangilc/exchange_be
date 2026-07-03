아래는 요청하신 **4가지 주제**를 **하나씩, 실제 구현 관점으로 풀어서** 설명한 **완성본 가이드**입니다.  
각 항목은 **“왜 필요한지 → 실제 코드/구조 → 실무 팁”** 흐름으로 구성했습니다.

***

# 1️⃣ 오더북 Off‑Heap 구현

## (ByteBuffer + VarHandle 실제 코드)

> 목적  
> ✅ **GC 완전 회피**  
> ✅ **수십만\~수백만 가격 레벨 유지**  
> ✅ **μs 단위 지연**

***

## 1.1 왜 Off‑Heap이 필요한가?

Heap 기반 객체는:

*   주문 증가 → 객체 폭증
*   GC pause → **호가 데이터 순간 멈춤**

거래소에서는 이게 **치명적**입니다.

👉 해결책: **Off‑Heap 메모리**

***

## 1.2 메모리 레이아웃 설계

### 가격 레벨 단위로만 유지 (주문 개별 ❌)

```text
[price][totalQty][price][totalQty]...
```

*   price: long (8 byte)
*   qty  : long (8 byte)

✅ **object 없음**
✅ **GC 대상 아님**

***

## 1.3 ByteBuffer + VarHandle 코드

```java
import java.lang.invoke.MethodHandles;
import java.lang.invoke.VarHandle;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public final class OffHeapOrderBook {

    private static final VarHandle LONG_HANDLE =
            MethodHandles.byteBufferViewVarHandle(
                long[].class, ByteOrder.nativeOrder());

    private static final int ENTRY_SIZE = 16; // price(8) + qty(8)

    private final ByteBuffer buffer;
    private final int capacity;
    private volatile int size = 0;

    public OffHeapOrderBook(int maxLevels) {
        this.capacity = maxLevels;
        this.buffer = ByteBuffer
                .allocateDirect(maxLevels * ENTRY_SIZE)
                .order(ByteOrder.nativeOrder());
    }

    public void put(long price, long qty) {
        int offset = size * ENTRY_SIZE;
        LONG_HANDLE.set(buffer, offset, price);
        LONG_HANDLE.set(buffer, offset + 8, qty);
        size++;
    }

    public long priceAt(int idx) {
        return (long) LONG_HANDLE.get(buffer, idx * ENTRY_SIZE);
    }

    public long qtyAt(int idx) {
        return (long) LONG_HANDLE.get(buffer, idx * ENTRY_SIZE + 8);
    }
}
```

✅ **GC 영향 0**  
✅ **NUMA 친화적**  
✅ 실제 HFT 엔진들에서 쓰는 패턴

***

## 1.4 실무 팁

*   Heap에는 **Delta 계산, 이벤트 생성만**
*   Book 상태는 **Off‑Heap 전용**
*   가격 정렬은 **엔진 로직으로 보장**

***

# 2️⃣ Hot Symbol 샤딩 & 재조합기

> 목적  
> ✅ BTC, ETH 같은 종목 초고부하 분산  
> ✅ 가격/시간 우선 불변식 유지

***

## 2.1 기본 문제

BTC‑USD:

*   초당 수만 주문
*   단일 엔진 → CPU 한계

👉 샤딩 필요

***

## 2.2 가격 구간 샤딩 (정석)

```text
BTC-USD
 ├─ Engine-0 : ≥ 65000
 ├─ Engine-1 : 64000 ~ 64999
 └─ Engine-2 : < 64000
```

*   주문 가격 기준으로 엔진 라우팅
*   **가격 우선성 절대 유지**

***

## 2.3 Kafka 파티션 매핑

```text
Topic: orderbook-btc
Partition:
  0 → Engine-0
  1 → Engine-1
  2 → Engine-2
```

Key = shardId

✅ 각 파티션 = 단일 엔진

***

## 2.4 재조합기 (Aggregator)

### 역할

*   각 shard의 DELTA 수집
*   UI용 단일 OrderBook으로 재조합

```java
class OrderBookAggregator {
    Map<Integer, OffHeapOrderBook> shardBooks;

    UnifiedSnapshot snapshot() {
        // price 기준 merge
    }
}
```

UI에서는 **샤딩을 전혀 모름**

***

## 2.5 실무 팁

*   샤딩 경계는 **동적 조정 가능**
*   Hot price range만 분리해서 scale

***

# 3️⃣ HFT 네트워크 튜닝

## (TCP + Netty)

> 목적  
> ✅ 네트워크 지연 수백 μs → 수십 μs  
> ✅ 안정적 대량 연결

***

## 3.1 TCP 튜닝 (Linux)

```bash
sysctl -w net.core.somaxconn=65535
sysctl -w net.ipv4.tcp_fin_timeout=5
sysctl -w net.ipv4.tcp_tw_reuse=1
sysctl -w net.ipv4.tcp_nodelay=1
```

*   Nagle ❌
*   빠른 연결 재사용

***

## 3.2 Netty WebSocket 설정

```java
ServerBootstrap b = new ServerBootstrap();
b.childOption(ChannelOption.TCP_NODELAY, true)
 .childOption(ChannelOption.SO_SNDBUF, 1 << 20)
 .childOption(ChannelOption.SO_RCVBUF, 1 << 20)
 .childOption(ChannelOption.WRITE_BUFFER_WATER_MARK,
     new WriteBufferWaterMark(32*1024, 64*1024));
```

✅ backpressure  
✅ latency 급증 방지

***

## 3.3 메시지 전략

*   JSON ❌ (비용 큼)
*   ✅ **Binary Frame (FlatBuffers / SBE)**

```text
[price][qty][side][seq]
```

***

# 4️⃣ 프런트엔드 오더북 렌더링 가속

## (Canvas / WebGL)

> React DOM으로는 **거래소 UI 한계**

***

## 4.1 React DOM의 문제점

*   수백 가격 레벨
*   초당 수십 업데이트

👉 DOM diff 비용 폭발

***

## 4.2 Canvas 기반 렌더링

### 구조

```text
WebSocket
 → OrderBook Store(Map)
 → requestAnimationFrame
 → Canvas draw
```

***

### 예시 코드

```ts
function draw(ctx, bids, asks) {
  ctx.clearRect(0,0,w,h);

  bids.forEach((qty, price, y) => {
    ctx.fillStyle = "green";
    ctx.fillRect(0, y, qty * scale, rowHeight);
  });

  asks.forEach((qty, price, y) => {
    ctx.fillStyle = "red";
    ctx.fillRect(mid, y, qty * scale, rowHeight);
  });
}
```

✅ DOM 없음  
✅ FPS 60 유지

***

## 4.3 WebGL (극한 최적화)

*   vertex buffer에 price/qty
*   GPU에서 렌더
*   **10만 레벨도 가능**

실거래소/시뮬레이터에서 사용

***

## 4.4 UI 불변 규칙

*   ✅ Delta만 적용
*   ✅ seq 불일치 → Snapshot
*   ❌ 상태 계산 UI에서 하지 않음

***

# ✅ 최종 전체 요약

| 영역        | 핵심                       |
| --------- | ------------------------ |
| OrderBook | Off‑Heap + 단일 스레드        |
| Scale‑out | 가격 구간 샤딩                 |
| Transport | Kafka + Binary WebSocket |
| JVM       | ZGC + CPU pin            |
| UI        | Canvas / WebGL           |

***

## ✅ 한 문장 결론

> **실거래소 성능은 “알고리즘보다 구조”에서 결정되며,  
> Off‑Heap · 단일 엔진 불변식 · Kafka · Binary Push · Canvas 렌더링을 결합하면  
> 상용 거래소 수준의 실시간성과 안정성을 확보할 수 있다.**

***

원하시면 다음으로 이어서 가능합니다:

*   🔥 실제 **Complete Java Project 구조**
*   🔥 Netty WebSocket 서버 풀 구현
*   🔥 바이너리 프로토콜(SBE) 정의
*   🔥 주문 폭주/시장 급변 시 Circuit Breaker

👉 **다음으로 보고 싶은 하나만 골라 주세요.**
