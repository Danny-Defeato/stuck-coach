/** Practice file: this one has a compile error on purpose. */
public class MissingReturn {
    static String size(int n) {
        if (n < 10) {
            return "small";
        } else if (n < 100) {
            return "medium";
        }
    }

    public static void main(String[] args) {
        System.out.println(size(5));
    }
}
