import java.util.ArrayList;
import java.util.List;

/** Practice file: this one has a compile error on purpose. */
public class TypeMismatch {
    private final List<String> names = new ArrayList<>();

    private int findIndex(String name) {
        return names.indexOf(name);
    }

    public String lookup(String name) {
        return findIndex(name);
    }

    public static void main(String[] args) {
        TypeMismatch t = new TypeMismatch();
        t.names.add("Ada");
        System.out.println(t.lookup("Ada"));
    }
}
