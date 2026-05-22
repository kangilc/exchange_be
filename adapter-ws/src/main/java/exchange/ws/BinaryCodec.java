package exchange.ws;

import java.nio.ByteBuffer;

public final class BinaryCodec {
    /**
     * Encodes the OrderBook Delta event into a compact binary layout.
     * Layout: [SymbolId(4 bytes)][Seq(8 bytes)][Price(8 bytes)][Qty(8 bytes)][Side(4 bytes)] = Total 32 bytes
     * 
     * @param symbolId numeric ID representing the trading pair
     * @param seq sequence number for event ordering
     * @param price scaled integer-based price
     * @param deltaQty quantity change (positive for addition, negative for deduction)
     * @param side 0 for BUY, 1 for SELL
     * @return direct ByteBuffer containing the binary payload
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
