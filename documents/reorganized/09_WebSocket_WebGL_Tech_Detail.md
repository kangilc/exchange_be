# 09. WebSocket 및 WebGL 기술 디테일 (WS & WebGL)

본 문서는 실시간 호가 및 체결 데이터를 저지연으로 전송하고, 수만 건의 호가를 웹 브라우저에서 60fps로 시각화하기 위한 기술적 구현 상세를 설명합니다.

## 1. Binary WebSocket 통신 (Netty)
JSON 대신 바이너리 포맷(SBE 또는 직접 정의한 Layout)을 사용하여 직렬화/역직렬화 오버헤드를 최소화하고 가비지 컬렉션(GC) 발생을 억제합니다.

### ✅ Binary Codec 구현 (Java)
```java
// BinaryCodec.java
import java.nio.ByteBuffer;

public final class BinaryCodec {
    /**
     * OrderBook Delta 이벤트를 바이너리로 인코딩
     * Layout: [SymbolId(4)][Seq(8)][Price(8)][Qty(8)][Side(4)] = 총 32 bytes
     */
    public static ByteBuffer encodeDelta(
            int symbolId, long seq, long price, long deltaQty, int side) {
        
        ByteBuffer buf = ByteBuffer.allocateDirect(32);
        buf.putInt(symbolId);
        buf.putLong(seq);
        buf.putLong(price);
        buf.putLong(deltaQty);
        buf.putInt(side);
        buf.flip();
        return buf;
    }
}
```

### ✅ Netty를 통한 전송
```java
// WsHandler.java 내 전송 로직
ctx.writeAndFlush(new BinaryWebSocketFrame(Unpooled.wrappedBuffer(buffer)));
```

## 2. 클라이언트측 바이너리 디코딩 (JavaScript)
브라우저에서는 `DataView`를 사용하여 바이너리 프레임을 효율적으로 읽어들입니다.

```javascript
// ws-client.js
socket.onmessage = async (event) => {
    const buffer = await event.data.arrayBuffer();
    const dv = new DataView(buffer);
    
    const symbolId = dv.getInt32(0);
    const seq = dv.getBigInt64(4);
    const price = dv.getBigInt64(12);
    const qty = dv.getBigInt64(20);
    const side = dv.getInt32(28);

    updateOrderBook(price, qty, side);
};
```

## 3. WebGL 기반 오더북 렌더링
DOM 요소를 사용하는 대신 WebGL(또는 Canvas 2D 가속)을 사용하여 수만 개의 가격 레벨을 CPU 부하 없이 렌더링합니다.

### ✅ 렌더링 전략
*   **RequestAnimationFrame:** 브라우저의 주사율에 맞춰 그리기 주기를 최적화합니다.
*   **Price Map:** 호가창 데이터를 `Map<price, qty>` 구조로 관리하여 업데이트 성능을 확보합니다.
*   **Dirty Flag:** 데이터가 실제로 변했을 때만 버퍼를 갱신하고 다시 그립니다.

### ✅ WebGL 구현 개념
```javascript
const gl = canvas.getContext("webgl");

function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // 호가 데이터를 Vertex Buffer로 변환하여 GPU로 전송
    // 각 가격 레벨을 하나의 사각형(Rect)으로 렌더링
    const vertices = generateVerticesFromBook(bids, asks);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    
    requestAnimationFrame(draw);
}
```

## 4. 데이터 정합성 보장 (Snapshot & Delta)
*   **Full Snapshot:** 연결 직후 또는 시퀀스 갭 발생 시 전체 호가 상태를 수신합니다.
*   **Delta Update:** 실시간으로 들어오는 바이너리 델타 이벤트를 기존 호가창에 가산/감산합니다.
    ```javascript
    function updateOrderBook(price, qty, side) {
        const currentQty = book.get(price) || 0;
        const nextQty = currentQty + qty;
        
        if (nextQty <= 0) {
            book.delete(price);
        } else {
            book.set(price, nextQty);
        }
        markDirty(); // 다음 프레임에서 다시 그리도록 표시
    }
    ```

## 5. 성능 요약
| 기술 | 장점 | 기대 성능 |
| :--- | :--- | :--- |
| **Binary SBE** | GC 제거, 직렬화 오버헤드 최소화 | 인코딩/디코딩 < 10μs |
| **Netty** | 비차단 IO, 대규모 연결 수용 | 단일 서버 수만 동시 접속 |
| **WebGL** | GPU 가속, DOM 병목 제거 | 10,000+ 호가 레벨 60fps 유지 |
| **Delta Sync** | 네트워크 트래픽 급감 | 데이터 전송량 90% 이상 절감 |
