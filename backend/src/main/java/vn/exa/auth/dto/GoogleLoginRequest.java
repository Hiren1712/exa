package vn.exa.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import vn.exa.auth.User;

@Data
public class GoogleLoginRequest {

    @NotBlank
    @Size(max = 8192)
    private String idToken;

    private User.Role role;
}
