package exchange.engine.command;

import exchange.engine.domain.Order;

public record NewOrderCmd(Order order) implements Command {
}
