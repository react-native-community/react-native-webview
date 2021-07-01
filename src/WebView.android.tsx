import React from 'react';

import {
  Image,
  requireNativeComponent,
  UIManager as NotTypedUIManager,
  View,
  NativeModules,
  ImageSourcePropType,
  findNodeHandle,
} from 'react-native';

import BatchedBridge from 'react-native/Libraries/BatchedBridge/BatchedBridge';

import invariant from 'invariant';

import {
  defaultOriginWhitelist,
  createOnShouldStartLoadWithRequest,
  defaultRenderError,
  defaultRenderLoading,
} from './WebViewShared';
import {
  WebViewRenderProcessGoneEvent,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  WebViewNavigationEvent,
  WebViewProgressEvent,
  AndroidWebViewProps,
  NativeWebViewAndroid,
  State,
  RNCWebViewUIManagerAndroid,
} from './WebViewTypes';

import styles from './WebView.styles';

const UIManager = NotTypedUIManager as RNCWebViewUIManagerAndroid;

const RNCWebView = requireNativeComponent(
  'RNCWebView',
) as typeof NativeWebViewAndroid;
const { resolveAssetSource } = Image;

/**
 * A simple counter to uniquely identify WebView instances. Do not use this for anything else.
 */
let uniqueRef = 0;

/**
 * Renders a native WebView.
 */
class WebView extends React.Component<AndroidWebViewProps, State> {
  static defaultProps = {
    overScrollMode: 'always',
    javaScriptEnabled: true,
    thirdPartyCookiesEnabled: true,
    scalesPageToFit: true,
    allowsFullscreenVideo: false,
    allowFileAccess: false,
    saveFormDataDisabled: false,
    cacheEnabled: true,
    androidHardwareAccelerationDisabled: false,
    androidLayerType: 'none',
    originWhitelist: defaultOriginWhitelist,
    setSupportMultipleWindows: true,
    nestedScrollEnabled: false,
  };

  static isFileUploadSupported = async () => {
    // native implementation should return "true" only for Android 5+
    return NativeModules.RNCWebView.isFileUploadSupported();
  };

  startUrl: string | null = null;

  state: State = {
    viewState: this.props.startInLoadingState ? 'LOADING' : 'IDLE',
    lastErrorEvent: null,
  };

  onShouldStartLoadWithRequest: ReturnType<typeof createOnShouldStartLoadWithRequest> | null = null;

  webViewRef = React.createRef<NativeWebViewAndroid>();

  messagingModuleName = `WebViewMessageHandler${uniqueRef+=1}`;

  componentDidMount = () => {
    BatchedBridge.registerCallableModule(this.messagingModuleName, this);
  };

  getCommands = () => UIManager.getViewManagerConfig('RNCWebView').Commands;

  goForward = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      this.getCommands().goForward,
      undefined
    );
  };

  goBack = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      this.getCommands().goBack,
      undefined
    );
  };

  reload = () => {
    this.setState({
      viewState: 'LOADING',
    });
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      this.getCommands().reload,
      undefined
    );
  };

  stopLoading = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      this.getCommands().stopLoading,
      undefined
    );
  };

  requestFocus = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      this.getCommands().requestFocus,
      undefined
    );
  };

  postMessage = (data: string) => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      this.getCommands().postMessage,
      [String(data)],
    );
  };

  clearFormData = () => {
    UIManager.dispatchViewManagerCommand(
       this.getWebViewHandle(),
       this.getCommands().clearFormData,
        undefined,
    );
  }

  clearCache = (includeDiskFiles: boolean) => {
    UIManager.dispatchViewManagerCommand(
       this.getWebViewHandle(),
       this.getCommands().clearCache,
       [includeDiskFiles],
    );
  };

  clearHistory = () => {
    UIManager.dispatchViewManagerCommand(
       this.getWebViewHandle(),
       this.getCommands().clearHistory,
        undefined,
    );
  };

  /**
   * Injects a javascript string into the referenced WebView. Deliberately does not
   * return a response because using eval() to return a response breaks this method
   * on pages with a Content Security Policy that disallows eval(). If you need that
   * functionality, look into postMessage/onMessage.
   */
  injectJavaScript = (data: string) => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      this.getCommands().injectJavaScript,
      [data],
    );
  };

  /**
   * We return an event with a bunch of fields including:
   *  url, title, loading, canGoBack, canGoForward
   */
  updateNavigationState = (event: WebViewNavigationEvent) => {
    if (this.props.onNavigationStateChange) {
      this.props.onNavigationStateChange(event.nativeEvent);
    }
  };

  /**
   * Returns the native `WebView` node.
   */
  getWebViewHandle = () => {
    const nodeHandle = findNodeHandle(this.webViewRef.current);
    invariant(nodeHandle != null, 'nodeHandle expected to be non-null');
    return nodeHandle as number;
  };

  onLoadingStart = (event: WebViewNavigationEvent) => {
    const { onLoadStart } = this.props;
    const { nativeEvent: { url } } = event;
    this.startUrl = url;
    if (onLoadStart) {
      onLoadStart(event);
    }
    this.updateNavigationState(event);
  };

  onLoadingError = (event: WebViewErrorEvent) => {
    event.persist(); // persist this event because we need to store it
    const { onError, onLoadEnd } = this.props;

    if (onError) {
      onError(event);
    } else {
      console.warn('Encountered an error loading page', event.nativeEvent);
    }

    if (onLoadEnd) {
      onLoadEnd(event);
    }

    this.setState({
      lastErrorEvent: event.nativeEvent,
      viewState: 'ERROR',
    });
  };

  onHttpError = (event: WebViewHttpErrorEvent) => {
    const { onHttpError } = this.props;
    if (onHttpError) {
      onHttpError(event);
    }
  }

  onRenderProcessGone = (event: WebViewRenderProcessGoneEvent) => {
    const { onRenderProcessGone } = this.props;
    if (onRenderProcessGone) {
      onRenderProcessGone(event);
    }
  }

  onLoadingFinish = (event: WebViewNavigationEvent) => {
    const { onLoad, onLoadEnd } = this.props;
    const { nativeEvent: { url } } = event;
    if (onLoad) {
      onLoad(event);
    }
    if (onLoadEnd) {
      onLoadEnd(event);
    }
    if (url === this.startUrl) {
      this.setState({
        viewState: 'IDLE',
      });
    }
    this.updateNavigationState(event);
  };

  onMessage = (event: WebViewMessageEvent) => {
    const { onMessage } = this.props;
    if (onMessage) {
      onMessage(event);
    }
  };

  onLoadingProgress = (event: WebViewProgressEvent) => {
    const { onLoadProgress } = this.props;
    const { nativeEvent: { progress } } = event;
    if (progress === 1) {
      this.setState((state) => {
        if (state.viewState === 'LOADING') {
          return { viewState: 'IDLE' };
        }
        return null;
      });
    }
    if (onLoadProgress) {
      onLoadProgress(event);
    }
  };

  onShouldStartLoadWithRequestCallback = (
    shouldStart: boolean,
    url: string,
    lockIdentifier?: number,
  ) => {
    if (lockIdentifier) {
      NativeModules.RNCWebView.onShouldStartLoadWithRequestCallback(shouldStart, lockIdentifier);
    } else if (shouldStart) {
      UIManager.dispatchViewManagerCommand(
        this.getWebViewHandle(),
        this.getCommands().loadUrl,
        [String(url)],
      );
    }
  };

  render() {
    const {
      onMessage,
      onShouldStartLoadWithRequest: onShouldStartLoadWithRequestProp,
      originWhitelist,
      renderError,
      renderLoading,
      source,
      style,
      containerStyle,
      nativeConfig = {},
      ...otherProps
    } = this.props;

    let otherView = null;

    if (this.state.viewState === 'LOADING') {
      otherView = (renderLoading || defaultRenderLoading)();
    } else if (this.state.viewState === 'ERROR') {
      const errorEvent = this.state.lastErrorEvent;
      invariant(errorEvent != null, 'lastErrorEvent expected to be non-null');
      otherView = (renderError || defaultRenderError)(
        errorEvent.domain,
        errorEvent.code,
        errorEvent.description,
      );
    } else if (this.state.viewState !== 'IDLE') {
      console.error(
        `RNCWebView invalid state encountered: ${this.state.viewState}`,
      );
    }

    const webViewStyles = [styles.container, styles.webView, style];
    const webViewContainerStyle = [styles.container, containerStyle];

    if (typeof source !== "number" && source && 'method' in source) {
      if (source.method === 'POST' && source.headers) {
        console.warn(
          'WebView: `source.headers` is not supported when using POST.',
        );
      } else if (source.method === 'GET' && source.body) {
        console.warn('WebView: `source.body` is not supported when using GET.');
      }
    }

    const NativeWebView
      = (nativeConfig.component as typeof NativeWebViewAndroid) || RNCWebView;

    this.onShouldStartLoadWithRequest = createOnShouldStartLoadWithRequest(
      this.onShouldStartLoadWithRequestCallback,
      // casting cause it's in the default props
      originWhitelist as readonly string[],
      onShouldStartLoadWithRequestProp,
    );

    const webView = (
      <NativeWebView
        key="webViewKey"
        {...otherProps}
        messagingEnabled={typeof onMessage === 'function'}
        messagingModuleName={this.messagingModuleName}
        onLoadingError={this.onLoadingError}
        onLoadingFinish={this.onLoadingFinish}
        onLoadingProgress={this.onLoadingProgress}
        onLoadingStart={this.onLoadingStart}
        onHttpError={this.onHttpError}
        onRenderProcessGone={this.onRenderProcessGone}
        onMessage={this.onMessage}
        onShouldStartLoadWithRequest={this.onShouldStartLoadWithRequest}
        ref={this.webViewRef}
        // TODO: find a better way to type this.
        source={resolveAssetSource(source as ImageSourcePropType)}
        style={webViewStyles}
        {...nativeConfig.props}
      />
    );

    return (
      <View style={webViewContainerStyle}>
        {webView}
        {otherView}
      </View>
    );
  }
}

export default WebView;
