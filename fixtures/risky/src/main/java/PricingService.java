import java.math.BigDecimal;

public final class PricingService {
    private static volatile boolean newPricing =
        Boolean.parseBoolean(System.getenv("NEW_PRICING"));

    public BigDecimal quote(Order order) {
        if (newPricing) {
            return new PricingCalculator().calculate(order);
        }
        return legacyQuote(order);
    }

    public static void refreshConfiguration() {
        newPricing = Boolean.parseBoolean(System.getenv("NEW_PRICING"));
    }

    private BigDecimal legacyQuote(Order order) {
        return order.subtotal();
    }
}
