import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_user/main.dart';
import 'package:mobile_user/providers/exchange_provider.dart';

class FakeExchangeNotifier extends ExchangeNotifier {
  @override
  void initStore() {
    // Do nothing in tests to avoid real HTTP/WebSocket connections and pending timers
  }
}

void main() {
  testWidgets('Smoke test for JavaFExchangeApp', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          exchangeProvider.overrideWith((ref) => FakeExchangeNotifier()),
        ],
        child: const JavaFExchangeApp(),
      ),
    );
  });
}
