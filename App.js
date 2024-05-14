import 'fast-text-encoding';
import 'react-native-url-polyfill/auto';
import './sui/env';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Alert } from 'react-native';
import {
    authorize,
    refresh,
    revoke,
    prefetchConfiguration,
} from 'react-native-app-auth';
import {
    Page,
    Button,
    ButtonContainer,
    Form,
    FormLabel,
    FormValue,
    Heading,
} from './components';
import {
    doLogin,
    prepareLogin,
    getSaltFromMystenAPI,
    getZNPFromMystenAPI,
    UserKeyData,
    LoginResponse,
    executeTransactionWithZKP,
    getZNPFromEnoki,
    getSaltFromEnoki,
} from "./sui/zkLogin";
import { useSui } from "./sui/hooks/useSui";
import jwt_decode from "jwt-decode";
import { generateNonce, generateRandomness, genAddressSeed, getZkLoginSignature, jwtToAddress } from '@mysten/zklogin';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519'
import axios from "axios"


const defaultAuthState = {
    hasLoggedInOnce: false,
    provider: '',
    accessToken: '',
    accessTokenExpirationDate: '',
    refreshToken: '',
};

WebBrowser.maybeCompleteAuthSession();

const App = () => {
    const [authState, setAuthState] = useState(defaultAuthState);
    const { suiClient } = useSui();
    const [suiVars, setSuiVars] = useState();
    const [storeSuiConst, setStoreSuiConst] = useState();

    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        androidClientId: '224270927962-v7v15cvf59d97vuj96km0hertd39ri1g.apps.googleusercontent.com',
        iosClientId: '224270927962-pvl22s7ep33brf5pfmdlqcrgr9kf62je.apps.googleusercontent.com',
        webClientId: '224270927962-p5fasuku6k9p7i9q8o7phdsf7rm41r38.apps.googleusercontent.com',
    });

    const enokiGetNonce = async () => {
        const enokiToken = 'enoki_public_3347c0c8170e38d68ac9368d72fd6909';
        const url = 'https://api.enoki.mystenlabs.com/v1/zklogin/nonce';
        const ephemeralKeyPair = new Ed25519Keypair();
        const ephemeralPrivateKeyB64 = ephemeralKeyPair.export().privateKey;

        const ephemeralPublicKey = ephemeralKeyPair.getPublicKey();
        const ephemeralPublicKeyB64 = ephemeralPublicKey.toBase64();
        const ephemeralPublicKeySuiB64 = ephemeralPublicKey.toSuiPublicKey();

        const config = {
            headers: { Authorization: `Bearer ${enokiToken}` },
            body: {
                network: 'testnet',
                ephemeralPublicKey: ephemeralPublicKeyB64
            }
        };
        const res = await axios.post(url, config);
        console.log(res);
    }
    const zklogin = async () => {
        const suiConst = await prepareLogin(suiClient);
        setStoreSuiConst(() => suiConst);
        window.localStorage.setItem('sui const', JSON.stringify(suiConst));
        console.log('nonce is', suiConst.nonce);
        const params = new URLSearchParams({
            client_id: '224270927962-p5fasuku6k9p7i9q8o7phdsf7rm41r38.apps.googleusercontent.com',
            redirect_uri: 'http://localhost:19006',
            response_type: "id_token",
            scope: "openid",
            nonce: suiConst.nonce,
        });
        const loginURL = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
        window.location.replace(loginURL);
    }

    const enokiTest = async () => {
        const url = 'https://api.enoki.mystenlabs.com/v1/app';
        const enokiToken = 'enoki_public_3347c0c8170e38d68ac9368d72fd6909';
        // , "zklogin-jwt": jwtEncoded
        const jwtEncoded = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImEzYjc2MmY4NzFjZGIzYmFlMDA0NGM2NDk2MjJmYzEzOTZlZGEzZTMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIyMjQyNzA5Mjc5NjItcDVmYXN1a3U2azlwN2k5cThvN3BoZHNmN3JtNDFyMzguYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiIyMjQyNzA5Mjc5NjItcDVmYXN1a3U2azlwN2k5cThvN3BoZHNmN3JtNDFyMzguYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDQ1NjEyMzgxODI0MTQzODUyNzgiLCJub25jZSI6Im00V2xqXy1jeVNrYjlxWnB4SzZXeW5kb3dBQSIsIm5iZiI6MTcxNTY2OTQxOCwiaWF0IjoxNzE1NjY5NzE4LCJleHAiOjE3MTU2NzMzMTgsImp0aSI6IjI3YzFjOWJjYThkODExMzQwMTRlNWZhYTIxMTRhNmMzM2Q3MDAwNDMifQ.cHt2H53gA0JMLnBr4awcyOUZHm_qcrBY7eDB_vRvZ4fV1HizUHc_CEEsrCdyX1bdbQWCAp_7uhnF9d6LN--qxq67_h-_Cp-lDlFXvX65_3oR58aNRg6mfsFQz-8YGxreinQMrilorH6wrrvUPOvSCMc2RYCbE8_D4a8qR6WwlvLBM6sKXARAqCW_5sQGuVY8hmLTAqUBpYq-Zf3GmNkq3InktI61jSk7YoBSqTxCIuq9vG2VGsJfyaTc7D5YljffYrlodmQJFXUDWVc7Ky-g05-GqH2D_6mv7lyR9Til4LhNHiJqy7XD3OxmSa0vAiHlrhmi5H2D93K5mvY-_vc9-Q&authuser=0&prompt=none';
        const config = {
            headers: { Authorization: `Bearer ${enokiToken}` }
        };

        // console.log("Getting salt:", url, config);
        const res = await axios.get(url, config);
        console.log('enoki test', res);
    }

    const getZKP = useCallback(async (jwt) => {
        try {
            console.log('jwt', jwt);
            const decodeJwt = jwt_decode(jwt);
            console.log('decode', decodeJwt);
            const iToken = decodeJwt.jti;
            console.log('id token', iToken);
            const address = jwtToAddress(jwt, BigInt(0));
            console.log('address is ', address);
            const suiconst = window.localStorage.getItem('sui const');
            console.log('local storage sui const', JSON.parse(suiconst));
            const userKey = JSON.parse(suiconst);
            // get salt from enoki
            // get zkp from enoki
            // devnet enoki_public_c4f679ba66bd72bcbebcdbbff9e8dac4
            // testnet enoki_public_3347c0c8170e38d68ac9368d72fd6909
            const enokiToken = 'enoki_public_c4f679ba66bd72bcbebcdbbff9e8dac4';
            const res = await getZNPFromEnoki(jwt, userKey, enokiToken, true);
            console.log(res);
        } catch (error) {

        } finally {
            window.localStorage.removeItem('sui const');
        }

    }, [storeSuiConst])

    useEffect(() => {
        if (response) {
            // console.log('request is ', request);
            console.log('response is ', response);
        }
    }, [response]);

    useEffect(() => {
        const curUrl = window.location.href;
        const jwt = curUrl.split('id_token=')[1];
        if (jwt) {
            getZKP(jwt);
        }

    }, [])

    const handleAuthorize = useCallback(async provider => {
        try {
            const suiConst = await prepareLogin(suiClient);

            setSuiVars(suiConst);
            const configuration = {
                warmAndPrefetchChrome: true,
                connectionTimeoutSeconds: 5,
                ...configs.auth0,
            };
            prefetchConfiguration(configuration);

            // const registerConfig = {
            //   additionalParameters: {
            //     nonce: suiConst.nonce,
            //   },
            // };
            // const registerResult = await register(registerConfig);

            const config = {
                ...testConfig,
                useNonce: false,
                additionalParameters: {
                    nonce: suiConst.nonce,
                },
                connectionTimeoutSeconds: 5,
                iosPrefersEphemeralSession: true,
                prefersEphemeralWebBrowserSession: true,
            };
            console.log('config is ', config);
            // debugger;
            const newAuthState = await authorize(config);
            // const newAuthState = response;
            console.log('response is ', newAuthState)
            setAuthState({
                hasLoggedInOnce: true,
                provider: provider,
                ...newAuthState,
            });

            console.log('Google auth jwt :', newAuthState.idToken);
            console.log('From SUI const :', suiConst);


            // const decodedJwt = jwt_decode(newAuthState.idToken);
            // console.log('Google auth response.nonce :', decodedJwt.nonce);

            // if (decodedJwt.nonce !== suiConst.nonce) {
            //     Alert.alert('Missatching Google nonce! Your auth try was probably spoofed');
            //     return;
            // }

            // console.log("Google JWT response:", newAuthState.idToken);

            // zkLogin Flow
            // const salt = await getSaltFromMystenAPI(newAuthState.idToken);
            // // setSuiVars(...suiVars, salt);
            // console.log("Salt:", salt);

            // const zkp = await getZNPFromMystenAPI(newAuthState.idToken, salt, suiConst);
            // // setSuiVars(...suiVars, zkp);
            // const address = jwtToAddress(newAuthState.idToken, BigInt(salt));
            // console.log("ZKP:", zkp, 'my Address:', address);


            // // Execute sample transaction
            // const transactionData = executeTransactionWithZKP(newAuthState.idToken, zkp, suiConst, salt, suiClient);
            // console.log("Transaction finished:", transactionData);

        } catch (error) {
            Alert.alert('Failed to log in', error.message);
            console.log("log in Error:", error);
        }

    }, []);

    const handleAuthorize2 = useCallback(async provider => {
        try {

            const suiConst = await prepareLogin(suiClient);

            setSuiVars(suiConst);
            const configuration = {
                warmAndPrefetchChrome: true,
                connectionTimeoutSeconds: 5,
                ...configs.auth0,
            };
            prefetchConfiguration(configuration);

            // const registerConfig = {
            //   additionalParameters: {
            //     nonce: suiConst.nonce,
            //   },
            // };
            // const registerResult = await register(registerConfig);

            const config = {
                ...(configs[provider]),
                useNonce: false,
                additionalParameters: {
                    nonce: suiConst.nonce,
                },
                connectionTimeoutSeconds: 5,
                iosPrefersEphemeralSession: true,
                prefersEphemeralWebBrowserSession: true,
            };

            const newAuthState = await authorize(config);

            setAuthState({
                hasLoggedInOnce: true,
                provider: provider,
                ...newAuthState,
            });

            console.log('Google auth jwt :', newAuthState.idToken);
            console.log('From SUI const :', suiConst);


            const decodedJwt = jwt_decode(newAuthState.idToken);
            console.log('Google auth response.nonce :', decodedJwt.nonce);

            if (decodedJwt.nonce !== suiConst.nonce) {
                Alert.alert('Missatching Google nonce! Your auth try was probably spoofed');
                return;
            }

            console.log("Google JWT response:", newAuthState.idToken);

            // zkLogin Flow
            const salt = await getSaltFromEnoki(newAuthState.idToken, "enoki_apikey_3662ad8b95e837bc26cf41dee4900d37");
            // setSuiVars(...suiVars, salt);
            console.log("Salt from enoki:", salt);

            const zkp = await getZNPFromEnoki(newAuthState.idToken, suiConst, "enoki_apikey_3662ad8b95e837bc26cf41dee4900d37");
            // setSuiVars(...suiVars, zkp);
            // const address = jwtToAddress(newAuthState.idToken, BigInt(salt));
            console.log("ZKP from enoki:", zkp, 'my Address:', salt.address);


            // Execute sample transaction
            const transactionData = executeTransactionWithZKP(newAuthState.idToken, zkp, suiConst, salt.salt, suiClient);
            console.log("Transaction finished:", transactionData);

        } catch (error) {
            Alert.alert('Failed to log in', error.message);
            console.log("log in Error:", error);
        }

    }, []);

    const handleRefresh = useCallback(async provider => {
        try {

            const suiConst = await prepareLogin(suiClient);
            setSuiVars(suiConst);
            const configuration = {
                warmAndPrefetchChrome: true,
                connectionTimeoutSeconds: 5,
                nonce: suiConst.nonce,
                ...configs.auth0,
            };
            prefetchConfiguration(configuration);

            // const registerConfig = {
            //   additionalParameters: {
            //     nonce: suiConst.nonce,
            //   },
            // };
            // const registerResult = await register(registerConfig);

            const config = {
                ...(configs[provider]),
                useNonce: false,
                additionalParameters: {
                    nonce: suiConst.nonce,
                },
                state: {
                    nonce: suiConst.nonce,
                },
                connectionTimeoutSeconds: 5,
                iosPrefersEphemeralSession: false,
                prefersEphemeralWebBrowserSession: false,
            };
            console.log("Google refresh request:", config, "Auth state:", authState);
            const newAuthState = await authorize(config);
            //     , {
            //   refreshToken: authState.refreshToken,
            // });

            setAuthState({
                hasLoggedInOnce: true,
                provider: provider,
                ...newAuthState,
            });

            // console.log('Google auth jwt :', newAuthState);
            const decodedJwt = jwt_decode(newAuthState.idToken);
            console.log('Google refresh response.nonce :', decodedJwt.nonce);

            if (decodedJwt.nonce !== suiConst.nonce) {
                Alert.alert('Missatching Google nonce! Your auth try was probably spoofed');
                return;
            }

            // const salt = await getSaltFromMystenAPI(newAuthState.idToken);
            // // setSuiVars(...suiVars, salt);
            // console.log("Salt:", salt);
            //
            // const zkp = await getZNPFromMystenAPI(newAuthState.idToken, salt, suiConst);
            // // setSuiVars(...suiVars, zkp);
            // const address = jwtToAddress(newAuthState.idToken, BigInt(salt));
            // console.log("ZKP:", zkp, 'my Address:', address);
            //
            //
            // // Execute sample transaction
            // const transactionData = executeTransactionWithZKP(newAuthState.idToken, zkp, suiConst, salt, suiClient);
            // console.log("Transaction finished:", transactionData);


        } catch (error) {
            Alert.alert('Failed to refresh token', error.message);
        }
    }, [authState]);

    const handleRevoke = useCallback(async () => {
        try {
            const config = configs[authState.provider];
            await revoke(config, {
                tokenToRevoke: authState.accessToken,
                sendClientId: true,
            });

            setAuthState({
                provider: '',
                accessToken: '',
                accessTokenExpirationDate: '',
                refreshToken: '',
            });
        } catch (error) {
            Alert.alert('Failed to revoke token', error.message);
        }
    }, [authState]);

    const showRevoke = useMemo(() => {
        if (authState.accessToken) {
            const config = configs[authState.provider];
            if (config.issuer || config.serviceConfiguration.revocationEndpoint) {
                return true;
            }
        }
        return false;
    }, [authState]);

    return (
        <Page>
            {authState.accessToken ? (
                <Form>
                    <FormLabel>accessToken</FormLabel>
                    <FormValue>{authState.accessToken}</FormValue>
                    <FormLabel>accessTokenExpirationDate</FormLabel>
                    <FormValue>{authState.accessTokenExpirationDate}</FormValue>
                    <FormLabel>refreshToken</FormLabel>
                    <FormValue>{authState.refreshToken}</FormValue>
                    <FormLabel>scopes</FormLabel>
                    <FormValue>{authState.scopes}</FormValue>
                </Form>
            ) : (
                <Heading>
                    {authState.hasLoggedInOnce ? 'Goodbye.' : 'Hello, stranger.'}
                </Heading>
            )}

            <ButtonContainer>
                {!authState.accessToken ? (
                    <>
                        {/* <Button
                          onPress={() => handleAuthorize2('auth0')}
                          text="zkLogin with Enoki"
                          color="#DA2536"
                        /> */}
                        <Button
                            onPress={zklogin}
                            text="zkLogin deprecated flow"
                            color="#DA2536"
                        />
                    </>
                ) : null}
                {authState.refreshToken ? (
                    <Button onPress={() => handleRefresh('auth0')} text="Refresh" color="#24C2CB" />
                ) : null}
                {showRevoke ? (
                    <Button onPress={handleRevoke} text="Revoke" color="#EF525B" />
                ) : null}
            </ButtonContainer>
        </Page>
    );
};

export default App;
