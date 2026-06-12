package com.timecheck.service;

import com.timecheck.dto.LoginReq;
import com.timecheck.dto.ProfileReq;
import com.timecheck.dto.SignupReq;
import com.timecheck.dto.UserRsp;
import com.timecheck.mapper.UserMapper;
import com.timecheck.model.User;
import com.timecheck.security.SessionUser;
import com.timecheck.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import java.util.regex.Pattern;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final int USERNAME_MIN_LENGTH = 3;
    private static final int USERNAME_MAX_LENGTH = 50;
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_]+$");
    private static final int USER_NAME_MAX_LENGTH = 100;
    private static final int DEPARTMENT_MAX_LENGTH = 100;
    private static final int PASSWORD_MIN_LENGTH = 4;
    private static final int PASSWORD_MAX_LENGTH = 100;

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;

    public AuthService(
            UserMapper userMapper,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
    }

    @Transactional
    public UserRsp signup(SignupReq req, HttpServletRequest httpRequest) {
        String username = normalizeRequired(req.username(), "아이디");
        String password = normalizeRequired(req.password(), "비밀번호");
        String userName = normalizeRequired(req.userName(), "이름");
        String department = normalizeOptional(req.department(), DEPARTMENT_MAX_LENGTH);
        String team = normalizeOptional(req.team(), DEPARTMENT_MAX_LENGTH);
        String position = normalizeOptional(req.position(), DEPARTMENT_MAX_LENGTH);

        validateUsername(username);
        validatePassword(password);
        validateLength(userName, USER_NAME_MAX_LENGTH, "이름");

        if (userMapper.existsByUsername(username)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }

        User user = User.builder()
                .username(username)
                .pwd(passwordEncoder.encode(password))
                .displayName(userName)
                .department(department)
                .team(team)
                .position(position)
                .role("USER")
                .build();
        userMapper.insertUser(user);

        persistSession(username, password, httpRequest);
        return UserRsp.from(requireUser(user.getUserId()));
    }

    public UserRsp login(LoginReq req, HttpServletRequest httpRequest) {
        String username = normalizeRequired(req.username(), "아이디");
        String password = normalizeRequired(req.password(), "비밀번호");

        try {
            persistSession(username, password, httpRequest);
        } catch (BadCredentialsException ex) {
            throw new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        User user = userMapper.selectByUsername(username);
        if (user == null) {
            throw new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        return UserRsp.from(user);
    }

    public void logout(HttpServletRequest httpRequest) {
        SecurityContextHolder.clearContext();
        HttpSession session = httpRequest.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }

    public UserRsp findMe() {
        Long userId = SecurityUtils.requireCurrentUserId();
        return UserRsp.from(requireUser(userId));
    }

    public boolean usernameOk(String name, Long exceptUserId) {
        if (name == null) {
            return false;
        }
        String username = name.trim();
        if (username.isEmpty()) {
            return false;
        }
        try {
            validateUsername(username);
        } catch (IllegalArgumentException ex) {
            return false;
        }
        if (exceptUserId != null) {
            return !userMapper.existsByUsernameExcept(username, exceptUserId);
        }
        return !userMapper.existsByUsername(username);
    }

    @Transactional
    public UserRsp updateMe(ProfileReq req, HttpServletRequest httpRequest) {
        Long userId = SecurityUtils.requireCurrentUserId();
        User current = requireUserPwd(userId);

        String username = normalizeRequired(req.username(), "아이디");
        String userName = normalizeRequired(req.userName(), "이름");
        String department = normalizeOptional(req.department(), DEPARTMENT_MAX_LENGTH);
        String team = normalizeOptional(req.team(), DEPARTMENT_MAX_LENGTH);
        String position = normalizeOptional(req.position(), DEPARTMENT_MAX_LENGTH);
        String password = normPassword(req.password());

        validateUsername(username);
        validateLength(userName, USER_NAME_MAX_LENGTH, "이름");
        if (password != null) {
            validatePassword(password);
        }

        if (!username.equals(current.getUsername())
                && userMapper.existsByUsernameExcept(username, userId)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }

        User update = User.builder()
                .userId(userId)
                .username(username)
                .displayName(userName)
                .department(department)
                .team(team)
                .position(position)
                .pwd(password != null ? passwordEncoder.encode(password) : null)
                .build();
        userMapper.updateUser(update);
        refreshSession(userId, httpRequest);
        return UserRsp.from(requireUser(userId));
    }

    private User requireUser(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new IllegalStateException("사용자 정보를 찾을 수 없습니다.");
        }
        return user;
    }

    private User requireUserPwd(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new IllegalStateException("사용자 정보를 찾을 수 없습니다.");
        }
        User credentials = userMapper.selectByUsername(user.getUsername());
        if (credentials == null || credentials.getPwd() == null) {
            throw new IllegalStateException("사용자 정보를 찾을 수 없습니다.");
        }
        user.setPwd(credentials.getPwd());
        return user;
    }

    private void refreshSession(Long userId, HttpServletRequest httpRequest) {
        User user = requireUserPwd(userId);
        SessionUser sessionUser =
                new SessionUser(user.getUserId(), user.getUsername(), user.getPwd(), user.getRole());
        Authentication authentication =
                new UsernamePasswordAuthenticationToken(sessionUser, null, sessionUser.getAuthorities());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);

        HttpSession session = httpRequest.getSession(false);
        if (session != null) {
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        }
    }

    private String normPassword(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed;
    }

    private void persistSession(String username, String password, HttpServletRequest httpRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(username, password));

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);

        HttpSession session = httpRequest.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
    }

    private void validateUsername(String username) {
        if (username.length() < USERNAME_MIN_LENGTH) {
            throw new IllegalArgumentException("아이디는 " + USERNAME_MIN_LENGTH + "자 이상이어야 합니다.");
        }
        if (username.length() > USERNAME_MAX_LENGTH) {
            throw new IllegalArgumentException("아이디는 " + USERNAME_MAX_LENGTH + "자 이하여야 합니다.");
        }
        if (!USERNAME_PATTERN.matcher(username).matches()) {
            throw new IllegalArgumentException("아이디는 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");
        }
    }

    private void validatePassword(String password) {
        if (password.length() < PASSWORD_MIN_LENGTH) {
            throw new IllegalArgumentException("비밀번호는 4자 이상이어야 합니다.");
        }
        if (password.length() > PASSWORD_MAX_LENGTH) {
            throw new IllegalArgumentException("비밀번호는 100자 이하여야 합니다.");
        }
    }

    private void validateLength(String value, int maxLength, String fieldName) {
        if (value.length() > maxLength) {
            throw new IllegalArgumentException(fieldName + "은(는) " + maxLength + "자 이하여야 합니다.");
        }
    }

    private String normalizeRequired(String value, String fieldName) {
        if (value == null) {
            throw new IllegalArgumentException(fieldName + "을(를) 입력해 주세요.");
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException(fieldName + "을(를) 입력해 주세요.");
        }
        return trimmed;
    }

    private String normalizeOptional(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        validateLength(trimmed, maxLength, "입력값");
        return trimmed;
    }
}
