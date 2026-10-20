import java.util.HashMap;
import java.util.Map;

/** Practice file: compiles fine, but crashes when it runs. */
public class NullPointer {
    public static void main(String[] args) {
        Map<String, Integer> scores = new HashMap<>();
        scores.put("Ada", 90);
        int bob = scores.get("Bob");
        System.out.println("Bob scored " + bob);
    }
}
