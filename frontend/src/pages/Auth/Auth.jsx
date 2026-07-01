/**
 * Auth: login, registration, email confirmation, forgot/reset password.
 */
import { useEffect, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  Sparkles,
  Code,
  ArrowRight,
  Eye,
  EyeOff,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../services/auth/auth.service";
import styles from "./Auth.module.css";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { register, login } = useAuth();

  const [authMode, setAuthMode] = useState("login");
  const isLogin = authMode === "login";
  const isRegister = authMode === "register";
  const isForgot = authMode === "forgot";
  const isReset = authMode === "reset";
  const isVerifyEmail = authMode === "verifyEmail";
  const isResetOtp = authMode === "resetOtp";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [confirmationUrl, setConfirmationUrl] = useState(null);

  const confirmTokenFromUrl = searchParams.get("confirmToken");
  const resetTokenFromUrl = searchParams.get("resetToken");
  const confirmedParam = searchParams.get("confirmed");
  const confirmedMessage = searchParams.get("message");

  useEffect(() => {
    if (!confirmTokenFromUrl) return;

    let cancelled = false;

    const confirmFromLink = async () => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        await authService.confirmEmail(confirmTokenFromUrl);
        if (cancelled) return;

        setSuccessMessage("Email confirmed successfully. You can now sign in.");
        setAuthMode("login");
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("confirmToken");
            return next;
          },
          { replace: true },
        );
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Unable to confirm email.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    confirmFromLink();

    return () => {
      cancelled = true;
    };
  }, [confirmTokenFromUrl, setSearchParams]);

  // Handle redirect from backend confirm-email link
  useEffect(() => {
    if (!confirmedParam) return;
    if (confirmedParam === 'success') {
      setSuccessMessage('Email confirmed successfully. You can now sign in.');
      setAuthMode('login');
    } else {
      setError(confirmedMessage || 'Unable to confirm email.');
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('confirmed');
        next.delete('message');
        return next;
      },
      { replace: true },
    );
  }, [confirmedParam, confirmedMessage, setSearchParams]);

  useEffect(() => {
    if (!resetTokenFromUrl) return;

    setResetToken(resetTokenFromUrl);
    setAuthMode("reset");
    setSuccessMessage("Set your new password below.");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("resetToken");
        return next;
      },
      { replace: true },
    );
  }, [resetTokenFromUrl, setSearchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (isRegister) {
      if (!normalizedEmail) {
        setError("Email is required.");
        return;
      }
      if (!emailPattern.test(normalizedEmail)) {
        setError("Please enter a valid email address.");
        return;
      }
      if (!trimmedFirstName) {
        setError("First name is required.");
        return;
      }
      if (trimmedFirstName.length < 3) {
        setError("First name must be at least 3 characters long.");
        return;
      }
      if (!trimmedLastName) {
        setError("Last name is required.");
        return;
      }
      if (trimmedLastName.length < 3) {
        setError("Last name must be at least 3 characters long.");
        return;
      }
      if (!password.trim()) {
        setError("Password is required.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
      }
    }

    if (isLogin) {
      if (!normalizedEmail) {
        setError("Email is required.");
        return;
      }
      if (!emailPattern.test(normalizedEmail)) {
        setError("Please enter a valid email address.");
        return;
      }
      if (!password.trim()) {
        setError("Password is required.");
        return;
      }
    }

    if (isForgot) {
      if (!normalizedEmail) {
        setError("Email is required.");
        return;
      }
      if (!emailPattern.test(normalizedEmail)) {
        setError("Please enter a valid email address.");
        return;
      }
    }

    if (isVerifyEmail || isResetOtp) {
      if (!/^\d{6}$/.test(otp.trim())) {
        setError("Enter the 6-digit code from your email.");
        return;
      }
    }

    if (isReset) {
      if (!resetToken.trim()) {
        setError(
          "Password reset link is missing or expired. Request a new one.",
        );
        setAuthMode("forgot");
        return;
      }
      if (!newPassword.trim()) {
        setError("New password is required.");
        return;
      }
      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters long.");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError("Password confirmation does not match.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        await login({ email: normalizedEmail, password });
        setSuccessMessage("Sign-in successful. Redirecting...");
        setEmail("");
        setPassword("");
        setShowPassword(false);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const from = location.state?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
      } else if (isRegister) {
        const registerResult = await register({
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: normalizedEmail,
          password,
        });

        setSuccessMessage(
          `${registerResult.welcomeMessage} ${registerResult.confirmationMessage}`,
        );
        setConfirmationUrl(registerResult.confirmationUrl || null);
        setFirstName("");
        setLastName("");
        setPassword("");
        // Keep the email so the user can enter the 6-digit code next.
        setEmail(normalizedEmail);
        setOtp("");
        setAuthMode("verifyEmail");
      } else if (isVerifyEmail) {
        await authService.verifyEmailOtp({
          email: normalizedEmail,
          otp: otp.trim(),
        });
        setSuccessMessage("Email confirmed successfully. You can now sign in.");
        setOtp("");
        setPassword("");
        setConfirmationUrl(null);
        setAuthMode("login");
      } else if (isForgot) {
        const result = await authService.forgotPassword(normalizedEmail);
        setSuccessMessage(
          result.message ||
            "If an account exists for this email, a reset code was sent.",
        );
        setEmail(normalizedEmail);
        setOtp("");
        setAuthMode("resetOtp");
      } else if (isResetOtp) {
        const result = await authService.verifyResetOtp({
          email: normalizedEmail,
          otp: otp.trim(),
        });
        setResetToken(result.resetToken);
        setOtp("");
        setSuccessMessage("Code verified. Set your new password below.");
        setAuthMode("reset");
      } else if (isReset) {
        await authService.resetPassword({
          token: resetToken.trim(),
          newPassword,
        });
        setSuccessMessage(
          "Password reset successful. Please sign in with your new password.",
        );
        setResetToken("");
        setNewPassword("");
        setConfirmNewPassword("");
        setPassword("");
        setAuthMode("login");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setSuccessMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Email is required to resend a code.");
      return;
    }

    setLoading(true);
    try {
      if (isResetOtp) {
        const result = await authService.forgotPassword(normalizedEmail);
        setSuccessMessage(
          result.message || "A new reset code has been sent if the account exists.",
        );
      } else {
        const result = await authService.resendConfirmation(normalizedEmail);
        setSuccessMessage(
          result.message || "A new confirmation code has been sent.",
        );
      }
      setOtp("");
    } catch (err) {
      setError(err.message || "Unable to resend the code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.auth}>
      <section className={styles.auth__info}>
        <div className={styles.auth__infoContent}>
          <header className={styles.auth__infoHeader}>
            <div
              className={styles.auth__infoBranding}
              onClick={() => navigate("/")}
              title="Go to Home"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate("/");
                }
              }}
            >
              <div className={styles.auth__infoLogo} aria-hidden>
                <MessageSquare
                  className={styles.auth__infoLogoIcon}
                  size={22}
                />
              </div>
              <div className={styles.auth__infoBrandCopy}>
                <p className={styles.auth__infoTitle}>Evangadi Forum</p>
                <p className={styles.auth__infoTagline}>
                  Learn together. Ask with context.
                </p>
              </div>
            </div>
            <p className={styles.auth__infoDescription}>
              Sign in to post technical questions, follow threads, and search
              the forum with both keyword and AI similarity modes, built for
              Evangadi coursework and peer review.
            </p>
          </header>

          <div className={styles.auth__features}>
            <div className={styles.auth__feature}>
              <div className={styles.auth__featureIcon}>
                <Sparkles size={20} />
              </div>
              <div className={styles.auth__featureContent}>
                <h3 className={styles.auth__featureTitle}>Visible reasoning</h3>
                <p className={styles.auth__featureDescription}>
                  Threads stay readable: markdown, code blocks, and replies
                  build a mini knowledge base your cohort can revisit before
                  exams.
                </p>
              </div>
            </div>
            <div className={styles.auth__feature}>
              <div className={styles.auth__featureIcon}>
                <Code size={20} />
              </div>
              <div className={styles.auth__featureContent}>
                <h3 className={styles.auth__featureTitle}>
                  Low-friction workflow
                </h3>
                <p className={styles.auth__featureDescription}>
                  One layout for asking, answering, and scanning search results,
                  so you spend energy on the problem, not on hunting controls.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.auth__infoFooter}>
            <div className={styles.auth__infoFooterContent}>
              <div className={styles.auth__infoAvatars}>
                {[1, 2, 3].map((i) => (
                  <img
                    key={i}
                    src={`https://picsum.photos/seed/${i + 50}/100/100`}
                    className={styles.auth__infoAvatar}
                    alt="u"
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
              <span className={styles.auth__infoBadge}>
                Evangadi cohorts · weekly stand-ups · office-hour style help
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.auth__formSection}>
        <div className={styles.auth__formContainer}>
          <AnimatePresence mode="wait">
            <Motion.div
              key={authMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className={styles.auth__formHeader}>
                <h2 className={styles.auth__formTitle}>
                  {isLogin
                    ? "Sign in to your account"
                    : isRegister
                      ? "Create an account"
                      : isVerifyEmail
                        ? "Verify your email"
                        : isForgot
                          ? "Recover your password"
                          : isResetOtp
                            ? "Enter your reset code"
                            : "Set a new password"}
                </h2>
                <p className={styles.auth__formSubtitle}>
                  {isLogin
                    ? "Enter your email address and password to continue."
                    : isRegister
                      ? "Complete the form below to create your account."
                      : isVerifyEmail
                        ? "Enter the 6-digit code we emailed you, or use the link in that email."
                        : isForgot
                          ? "Enter your email and we will send a reset code and link."
                          : isResetOtp
                            ? "Enter the 6-digit code we emailed you to continue."
                            : "Choose a new password for your account."}
                </p>
              </div>

              <form className={styles.auth__form} onSubmit={handleSubmit}>
                {isRegister && (
                  <>
                    <div className={styles.auth__inputGroup}>
                      <label htmlFor="firstName" className={styles.auth__label}>
                        First Name
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        placeholder="First name"
                        className={styles.auth__input}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>

                    <div className={styles.auth__inputGroup}>
                      <label htmlFor="lastName" className={styles.auth__label}>
                        Last Name
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        placeholder="Last name"
                        className={styles.auth__input}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {!isReset && (
                  <div className={styles.auth__inputGroup}>
                    <label htmlFor="email" className={styles.auth__label}>
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      className={styles.auth__input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      readOnly={isVerifyEmail || isResetOtp}
                    />
                  </div>
                )}

                {(isVerifyEmail || isResetOtp) && (
                  <div className={styles.auth__inputGroup}>
                    <label htmlFor="otp" className={styles.auth__label}>
                      6-Digit Code
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      className={styles.auth__input}
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                    />
                    <button
                      type="button"
                      className={styles.auth__inlineLink}
                      onClick={handleResendCode}
                      disabled={loading}
                    >
                      Resend code
                    </button>
                  </div>
                )}

                {(isLogin || isRegister) && (
                  <div className={styles.auth__inputGroup}>
                    <div className={styles.auth__labelRow}>
                      <label htmlFor="password" className={styles.auth__label}>
                        Password
                      </label>
                      {isLogin && (
                        <button
                          type="button"
                          className={styles.auth__inlineLink}
                          onClick={() => {
                            setError(null);
                            setSuccessMessage(null);
                            setAuthMode("forgot");
                          }}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className={styles.auth__passwordWrap}>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className={`${styles.auth__input} ${styles.auth__inputPassword}`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.auth__passwordToggle}
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff size={18} aria-hidden />
                        ) : (
                          <Eye size={18} aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {isReset && (
                  <>
                    <div className={styles.auth__inputGroup}>
                      <label
                        htmlFor="newPassword"
                        className={styles.auth__label}
                      >
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        type="password"
                        placeholder="At least 8 characters"
                        className={styles.auth__input}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>

                    <div className={styles.auth__inputGroup}>
                      <label
                        htmlFor="confirmNewPassword"
                        className={styles.auth__label}
                      >
                        Confirm New Password
                      </label>
                      <input
                        id="confirmNewPassword"
                        type="password"
                        placeholder="Re-enter new password"
                        className={styles.auth__input}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {successMessage && (
                  <div className={styles.auth__success}>{successMessage}</div>
                )}
                {confirmationUrl && (
                  <div className={styles.auth__confirmLink}>
                    <strong>Confirm your email:</strong>{" "}
                    <a
                      href={confirmationUrl}
                      className={styles.auth__confirmAnchor}
                    >
                      Click here to verify your address
                    </a>
                    <span className={styles.auth__confirmNote}>
                      (Development only — in production this link is sent by
                      email)
                    </span>
                  </div>
                )}
                {error && <div className={styles.auth__error}>{error}</div>}

                <div className={styles.auth__buttonContainer}>
                  <button
                    type="submit"
                    className={`${styles.auth__button} ${styles["auth__button--primary"]}`}
                    disabled={loading}
                  >
                    {loading
                      ? "Processing..."
                      : isLogin
                        ? "Sign In"
                        : isRegister
                          ? "Create Account"
                          : isVerifyEmail
                            ? "Verify Email"
                            : isForgot
                              ? "Send Recovery Email"
                              : isResetOtp
                                ? "Verify Code"
                                : "Reset Password"}
                    {!loading && (
                      <ArrowRight
                        size={16}
                        className={styles.auth__buttonIcon}
                      />
                    )}
                  </button>
                </div>

                <div className={styles.auth__divider}>
                  <div className={styles.auth__dividerLine}>
                    <div className={styles.auth__dividerBorder}></div>
                  </div>
                  <div className={styles.auth__dividerText}>
                    Additional options
                  </div>
                </div>
              </form>

              <footer className={styles.auth__formFooter}>
                <p className={styles.auth__formFooterText}>
                  {isLogin && "Don't have an account?"}
                  {isRegister && "Already have an account?"}
                  {isVerifyEmail && "Already verified?"}
                  {(isForgot || isReset || isResetOtp) &&
                    "Remembered your password?"}

                  {isLogin && (
                    <button
                      onClick={() => setAuthMode("register")}
                      className={styles.auth__formFooterLink}
                    >
                      Create an account
                    </button>
                  )}
                  {isRegister && (
                    <button
                      onClick={() => setAuthMode("login")}
                      className={styles.auth__formFooterLink}
                    >
                      Back to sign in
                    </button>
                  )}
                  {(isForgot ||
                    isReset ||
                    isResetOtp ||
                    isVerifyEmail) && (
                    <button
                      onClick={() => setAuthMode("login")}
                      className={styles.auth__formFooterLink}
                    >
                      Back to sign in
                    </button>
                  )}
                </p>
              </footer>
            </Motion.div>
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
