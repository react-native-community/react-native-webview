/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Portions copyright for react-native-windows:
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import React from 'react';
import {
  UIManager as NotTypedUIManager,
  View,
  requireNativeComponent,
  StyleSheet,
  Image,
  ImageSourcePropType,
  findNodeHandle,
} from 'react-native';
import {
  createOnShouldStartLoadWithRequest,
} from './WebViewShared';
import {
  NativeWebViewWindows,
  WebViewSharedProps,
  WebViewProgressEvent,
  WebViewNavigationEvent,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  RNCWebViewUIManagerWindows,
  State,
} from './WebViewTypes';

const UIManager = NotTypedUIManager as RNCWebViewUIManagerWindows;
const { resolveAssetSource } = Image;
const RCTWebView: typeof NativeWebViewWindows = requireNativeComponent(
  'RCTWebView',
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hidden: {
    height: 0,
    flex: 0, // disable 'flex:1' when hiding a View
  },
  loadingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingProgressBar: {
    height: 20,
  },
});

export default class WebView extends React.Component<WebViewSharedProps, State> {

  static defaultProps = {
    javaScriptEnabled: true,
  };

  state: State = {
    viewState: this.props.startInLoadingState ? 'LOADING' : 'IDLE',
    lastErrorEvent: null,
  }

  webViewRef = React.createRef<NativeWebViewWindows>();

  goForward = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      UIManager.getViewManagerConfig('RCTWebView').Commands.goForward,
      undefined,
    );
  }

  goBack = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      UIManager.getViewManagerConfig('RCTWebView').Commands.goBack,
      undefined,
    );
  }

  reload = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      UIManager.getViewManagerConfig('RCTWebView').Commands.reload,
      undefined,
    );
  }

  injectJavaScript = (data: string) => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      UIManager.getViewManagerConfig('RCTWebView').Commands.injectJavaScript,
      [data],
    );
  }

  postMessage = (data: string) => {    
    const message = this.getInjectableJSMessage(data);
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      UIManager.getViewManagerConfig('RCTWebView').Commands.injectJavaScript,
      [message],
    );
  };

  getInjectableJSMessage = (message: string ) => {
    return `(function() {window.dispatchEvent(new MessageEvent('message', {data: ${JSON.stringify(
      message
    )}}));})();`;
  }



  /**
   * We return an event with a bunch of fields including:
   *  url, title, loading, canGoBack, canGoForward
   */
  updateNavigationState = (event: WebViewNavigationEvent) => {
    if (this.props.onNavigationStateChange) {
      this.props.onNavigationStateChange(event.nativeEvent);
    }
  }

  getWebViewHandle = () => {
    // eslint-disable-next-line react/no-string-refs
    return findNodeHandle(this.webViewRef.current);
  }

  onLoadingStart = (event: WebViewNavigationEvent) => {
    const { onLoadStart } = this.props;
    if(onLoadStart) {
      onLoadStart(event);
    }
    this.updateNavigationState(event);
  }

  onLoadingProgress = (event: WebViewProgressEvent) => {
    const { onLoadProgress } = this.props;
    if (onLoadProgress) {
      onLoadProgress(event);
    }
  };

  onLoadingError = (event: WebViewErrorEvent) => {
    event.persist(); // persist this event because we need to store it
    const {onError, onLoadEnd} = this.props;
    if(onError) {
      onError(event);
    }
    if(onLoadEnd) {
      onLoadEnd(event);
    }
    if (event.isDefaultPrevented()) return;
    console.error('Encountered an error loading page', event.nativeEvent);
    this.setState({
      lastErrorEvent: event.nativeEvent,
      viewState: 'ERROR',
    });
  }

  onLoadingFinish =(event: WebViewNavigationEvent) => {
    const {onLoad, onLoadEnd} = this.props;
    if(onLoad) {
      onLoad(event);
    }
    if(onLoadEnd) {
      onLoadEnd(event);
    }
    this.setState({
      viewState: 'IDLE',
    });
    this.updateNavigationState(event);
  }

  onMessage = (event: WebViewMessageEvent) => {
    const { onMessage } = this.props;
    if (onMessage) {
      onMessage(event);
    }
  }

  onHttpError = (event: WebViewHttpErrorEvent) => {
    const { onHttpError } = this.props;
    if (onHttpError) {
      onHttpError(event);
    }
  }

  render () {
    const {
      nativeConfig = {},
      onMessage,
      onShouldStartLoadWithRequest: onShouldStartLoadWithRequestProp,
      originWhitelist,
      renderError,
      renderLoading,
      style,
      containerStyle,
      ...otherProps
    } = this.props;

    let otherView = null;

    if (this.state.viewState === 'LOADING') {
      otherView = this.props.renderLoading && this.props.renderLoading();
    } else if (this.state.viewState === 'ERROR') {
      const errorEvent = this.state.lastErrorEvent;
      otherView = this.props.renderError
        && this.props.renderError(
          errorEvent.domain,
          errorEvent.code,
          errorEvent.description,
        );
    } else if (this.state.viewState !== 'IDLE') {
      console.error('RCTWebView invalid state encountered: ', this.state.viewState);
    }

    const webViewStyles = [styles.container, this.props.style];
    if (
      this.state.viewState === 'LOADING'
      || this.state.viewState === 'ERROR'
    ) {
      // if we're in either LOADING or ERROR states, don't show the webView
      webViewStyles.push(styles.hidden);
    }

    const onShouldStartLoadWithRequest = createOnShouldStartLoadWithRequest(
      ()=>{},
      // casting cause it's in the default props
      originWhitelist as readonly string[],
      onShouldStartLoadWithRequestProp,
    );

    const NativeWebView
    = (nativeConfig.component as typeof NativeWebViewWindows | undefined)
    || RCTWebView;

    const webView = (
      <NativeWebView
        ref={this.webViewRef}
        key="webViewKey"
        {...otherProps}
        messagingEnabled={typeof onMessage === 'function'}
        onLoadingError={this.onLoadingError}
        onLoadingFinish={this.onLoadingFinish}
        onLoadingProgress={this.onLoadingProgress}
        onLoadingStart={this.onLoadingStart}
        onHttpError={this.onHttpError}
        onMessage={this.onMessage}
        onScroll={this.props.onScroll}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        source={resolveAssetSource(this.props.source as ImageSourcePropType)}
        style={webViewStyles}
        {...nativeConfig.props}
      />
    );

    return (
      <View style={styles.container}>
        {webView}
        {otherView}
      </View>
    );
  }

}
