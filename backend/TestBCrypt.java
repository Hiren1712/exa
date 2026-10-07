import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class TestBCrypt {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);
        String hash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
        
        System.out.println("Test 'password' vs hash: " + encoder.matches("password", hash));
        System.out.println("Test 'Password' vs hash: " + encoder.matches("Password", hash));
        System.out.println("Test 'admin' vs hash: " + encoder.matches("admin", hash));
        System.out.println("Test '123456' vs hash: " + encoder.matches("123456", hash));
        System.out.println("Test '' vs hash: " + encoder.matches("", hash));
    }
}