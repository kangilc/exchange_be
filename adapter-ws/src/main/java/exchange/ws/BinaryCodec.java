package exchange.ws;

import java.nio.ByteBuffer;

/**
 * 웹소켓 전송용 바이너리 인코더 클래스.
 * 대역폭 최적화를 위해 오더북 델타 이벤트를 수동으로 패킹한다.
 */
public final class BinaryCodec {
    /**
     * 오더북 델타 이벤트를 32바이트 바이너리로 압축하여 인코딩한다.
     * 구조: [SymbolId(4 bytes)][Seq(8 bytes)][Price(8 bytes)][Qty(8 bytes)][Side(4 bytes)]
     * 
     * @param symbolId 거래쌍 숫자 ID
     * @param seq 이벤트 시퀀스 번호
     * @param price 정수형 스케일 가격
     * @param deltaQty 수량 증감치 (양수: 추가, 음수: 차감)
     * @param side 0: 매수(BUY), 1: 매도(SELL)
     * @return 바이너리 페이로드가 담긴 Direct ByteBuffer
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
