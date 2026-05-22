package exchange.engine.command;

public sealed interface Command permits NewOrderCmd, CancelOrderCmd {
}
