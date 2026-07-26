import static org.junit.jupiter.api.Assertions.assertEquals;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

final class PricingServiceTest {
    @Test
    void legacyQuoteUsesSubtotal() {
        PricingService service = new PricingService();
        assertEquals(new BigDecimal("10.00"), service.quote(new Order("10.00")));
    }
}
