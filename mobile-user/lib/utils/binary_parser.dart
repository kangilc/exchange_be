import 'dart:typed_data';

/// 실시간 게이트웨이에서 보내오는 32바이트 바이너리 데이터를 디코딩하는 모델
class OrderbookUpdate {
  final int symbolId; // 0~3 bytes (Int32)
  final int price;    // 12~19 bytes (Int64, 100배 스케일링된 정수 가격)
  final int qty;      // 20~27 bytes (Int64, 수량 변화량. 음수일 경우 매칭(체결) 발생을 의미)
  final int side;     // 28~31 bytes (Int32, 0: 매수/BID, 1: 매도/ASK)

  OrderbookUpdate({
    required this.symbolId,
    required this.price,
    required this.qty,
    required this.side,
  });

  /// 32바이트 Uint8List 패킷을 파싱하여 객체로 변환
  factory OrderbookUpdate.fromBinary(Uint8List bytes) {
    if (bytes.length != 32) {
      throw ArgumentError('바이너리 데이터 크기는 반드시 32바이트여야 합니다. (실제 크기: ${bytes.length} bytes)');
    }

    final byteData = ByteData.sublistView(bytes);

    // 빅 엔디안(Big Endian) 형태로 데이터 언팩 실행
    final parsedSymbolId = byteData.getInt32(0, Endian.big);
    final parsedPrice = byteData.getInt64(12, Endian.big);
    final parsedQty = byteData.getInt64(20, Endian.big);
    final parsedSide = byteData.getInt32(28, Endian.big);

    return OrderbookUpdate(
      symbolId: parsedSymbolId,
      price: parsedPrice,
      qty: parsedQty,
      side: parsedSide,
    );
  }

  /// 100배 곱해진 가격을 실제 소수점 단위 실수 가격으로 변환 (예: 6500000 -> 65000.0)
  double get realPrice => price / 100.0;

  @override
  String toString() {
    return 'OrderbookUpdate(symbolId: $symbolId, price: $realPrice, qty: $qty, side: $side)';
  }
}
