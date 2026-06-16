package exchange.engine.book;

import exchange.engine.domain.Order;
import exchange.engine.domain.Side;

import java.util.*;

/**
 * 인메모리 상에서 매수/매도 호가창과 대기 주문들을 관리하는 오더북(주문 원장) 클래스입니다.
 * 가격 탐색속도를 위해 TreeMap(NavigableMap)을 활용하며, 각 가격대별 대기 주문들은 큐(ArrayDeque) 구조로 관리합니다.
 */
public final class OrderBook {

    // 매수 주문 호가창 (TreeMap을 역순 정렬하여 가장 높은 가격의 매수 대기 주문이 가장 앞에 옵니다)
    public final NavigableMap<Long, ArrayDeque<Order>> bids =
            new TreeMap<>(Comparator.reverseOrder());

    // 매도 주문 호가창 (기본 TreeMap 정렬을 통해 가장 낮은 가격의 매도 대기 주문이 가장 앞에 옵니다)
    public final NavigableMap<Long, ArrayDeque<Order>> asks =
            new TreeMap<>();

    // orderId로 대기 주문 객체를 바로 찾을 수 있게 색인화하는 맵
    public final Map<Long, Order> orderIndex = new HashMap<>();
    
    // orderId로 해당 주문의 등록 가격을 신속히 매핑해 주는 색인 맵
    public final Map<Long, Long> orderPriceIndex = new HashMap<>();

    /**
     * 호가창에 신규 주문을 대기 주문(Resting Order)으로 등록합니다.
     * 
     * @param o 등록할 주문 객체
     */
    public void add(Order o) {
        var book = (o.side == Side.BUY) ? bids : asks;

        // 가격 그룹에 대기 주문 추가
        book.computeIfAbsent(o.price, k -> new ArrayDeque<>())
                .addLast(o);

        // 빠른 조회를 위해 색인 맵에 저장
        orderIndex.put(o.orderId, o);
        orderPriceIndex.put(o.orderId, o.price);
    }

    /**
     * 주문 ID로 활성화된 대기 주문을 찾습니다.
     * 
     * @param orderId 찾을 주문 ID
     * @return 매칭되는 주문 객체 (없을 경우 null)
     */
    public Order find(long orderId) {
        return orderIndex.get(orderId);
    }

    /**
     * 호가창에서 주문을 안전하게 취소/제거합니다.
     * 
     * @param o 제거할 주문 객체
     */
    public void remove(Order o) {
        var book = (o.side == Side.BUY) ? bids : asks;
        Long price = orderPriceIndex.remove(o.orderId);
        orderIndex.remove(o.orderId);

        if (price == null) return;

        var q = book.get(price);
        if (q != null) {
            // 호가 큐에서 매칭되는 ID의 주문을 제거
            q.removeIf(x -> x.orderId == o.orderId);
            // 해당 가격대에 대기 중인 주문이 하나도 없으면 트리맵에서 해당 호가 항목 삭제
            if (q.isEmpty()) {
                book.remove(price);
            }
        }
    }
}
