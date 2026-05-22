package exchange.engine.command;

public record CancelOrderCmd(long orderId) implements Command {
}
