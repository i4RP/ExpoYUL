import * as React from "react";
import { View, Image, SafeAreaView, TextInput, StyleSheet } from "react-native";

import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import {
  isClerkAPIResponseError,
  useSignIn,
  useSignUp,
  useSSO,
  useUser,
} from "@clerk/clerk-expo";
import { ClerkAPIError } from "@clerk/types";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";

// Handle any pending authentication sessions
WebBrowser.maybeCompleteAuthSession();

export default function Index() {
  const { startSSOFlow } = useSSO();
  const { user, isSignedIn } = useUser();
  const { signIn, setActive } = useSignIn();
  const { signUp } = useSignUp();
  const [errors, setErrors] = React.useState<ClerkAPIError[]>([]);
  
  const [email, setEmail] = React.useState("");
  const [verificationCode, setVerificationCode] = React.useState("");
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isSigningUp, setIsSigningUp] = React.useState(false);

  const handleSignInWithGoogle = React.useCallback(async () => {
    try {
      // Start the authentication process by calling `startSSOFlow()`
      const { createdSessionId, setActive, signIn, signUp } =
        await startSSOFlow({
          strategy: "oauth_google",
          // Defaults to current path
          redirectUrl: AuthSession.makeRedirectUri(),
        });

      // If sign in was successful, set the active session
      if (createdSessionId) {
        setActive!({ session: createdSessionId });
      } else {
        // If there is no `createdSessionId`,
        // there are missing requirements, such as MFA
        // Use the `signIn` or `signUp` returned from `startSSOFlow`
        // to handle next steps
      }
    } catch (err) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
      if (isClerkAPIResponseError(err)) setErrors(err.errors);
      console.error(JSON.stringify(err, null, 2));
    }
  }, []);

  const signInWithPasskey = async () => {
    // 'discoverable' lets the user choose a passkey
    // without auto-filling any of the options
    try {
      const signInAttempt = await signIn?.authenticateWithPasskey({
        flow: "discoverable",
      });

      if (signInAttempt?.status === "complete") {
        if (setActive !== undefined) {
          await setActive({ session: signInAttempt.createdSessionId });
        }
      } else {
        // If the status is not complete, check why. User may need to
        // complete further steps.
        console.error(JSON.stringify(signInAttempt, null, 2));
      }
    } catch (err) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
      console.error("Error:", JSON.stringify(err, null, 2));
    }
  };

  const handleEmailSubmit = async () => {
    if (!email) return;
    setErrors([]);
    
    try {
      const { supportedFirstFactors } = await signIn!.create({
        identifier: email,
      });
      
      const emailCodeFactor = supportedFirstFactors?.find(
        factor => factor.strategy === 'email_code'
      );
      
      if (emailCodeFactor) {
        const { emailAddressId } = emailCodeFactor as any;
        await signIn!.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId,
        });
        setIsVerifying(true);
        setIsSigningUp(false);
      } else {
        await signUp!.create({
          emailAddress: email,
        });
        await signUp!.prepareEmailAddressVerification();
        setIsVerifying(true);
        setIsSigningUp(true);
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) setErrors(err.errors);
      console.error("Error:", JSON.stringify(err, null, 2));
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return;
    setErrors([]);
    
    try {
      if (isSigningUp) {
        const signUpAttempt = await signUp!.attemptEmailAddressVerification({
          code: verificationCode,
        });
        
        if (signUpAttempt.status === "complete") {
          await setActive!({ session: signUpAttempt.createdSessionId });
        } else {
          console.error(JSON.stringify(signUpAttempt, null, 2));
        }
      } else {
        const signInAttempt = await signIn!.attemptFirstFactor({
          strategy: "email_code",
          code: verificationCode,
        });
        
        if (signInAttempt.status === "complete") {
          await setActive!({ session: signInAttempt.createdSessionId });
        } else {
          console.error(JSON.stringify(signInAttempt, null, 2));
        }
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) setErrors(err.errors);
      console.error("Error:", JSON.stringify(err, null, 2));
    }
  };

  const resetEmailFlow = () => {
    setIsVerifying(false);
    setVerificationCode("");
  };

  if (isVerifying) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 0.1 }} />
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={{ width: 80, height: 80 }}
            />
            <Text style={styles.title}>Verify your email</Text>
            <Text>Enter the code sent to {email}</Text>
            {errors.map((error) => (
              <Text key={error.code} style={styles.errorText}>{error.code}</Text>
            ))}
          </View>
          
          <View style={styles.inputContainer}>
            <TextInput
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="Verification code"
              keyboardType="number-pad"
              style={styles.input}
              autoFocus
            />
            <Button
              onPress={handleVerifyCode}
              style={styles.primaryButton}
            >
              <Text style={{ color: "white", fontWeight: "500" }}>
                Verify
              </Text>
            </Button>
            <Button
              onPress={resetEmailFlow}
              style={styles.secondaryButton}
            >
              <Text style={{ color: "black", fontWeight: "500" }}>
                Back
              </Text>
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* spacer */}
      <View style={{ flex: 0.1 }} />

      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={{ width: 100, height: 100 }}
          />
          <Text style={styles.title}>
            Modern Chat App
          </Text>
          <Text>Sign in to continue</Text>
          {errors.map((error) => (
            <Text key={error.code} style={styles.errorText}>{error.code}</Text>
          ))}
        </View>

        {/* Email OTP input */}
        <View style={styles.inputContainer}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <Button
            onPress={handleEmailSubmit}
            style={styles.primaryButton}
          >
            <Text style={{ color: "white", fontWeight: "500" }}>
              Continue with Email
            </Text>
          </Button>
        </View>

        {/* spacer */}
        <View style={{ flex: 0.5 }} />
        
        <Text style={styles.orText}>or continue with</Text>
        
        <Button
          onPress={signInWithPasskey}
          style={styles.passkeyButton}
        >
          <Text style={{ color: "white", fontWeight: "500" }}>
            Sign in with Passkey
          </Text>
        </Button>
        <Button
          onPress={handleSignInWithGoogle}
          style={styles.googleButton}
        >
          <Image
            source={require("@/assets/images/google-icon.png")}
            style={{ width: 20, height: 20 }}
          />
          <Text style={{ color: "black", fontWeight: "500" }}>
            Sign in with Google
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  headerContainer: {
    gap: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
  },
  inputContainer: {
    width: "100%",
    marginTop: 30,
    gap: 15,
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: "#f8f8f8",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#000",
    borderRadius: 8,
    height: 50,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    height: 50,
    marginTop: 10,
  },
  passkeyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
    backgroundColor: "black",
    borderColor: "white",
    borderWidth: 1,
    borderRadius: 8,
    height: 50,
    width: "100%",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 30,
    borderRadius: 8,
    height: 50,
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  orText: {
    marginVertical: 20,
    color: "#666",
  },
  errorText: {
    color: "red",
    marginTop: 5,
  },
});
