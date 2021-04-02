#include "pch.h"
#include "ReactWebViewManager.h"
#include "NativeModules.h"
#include "ReactWebView.h"
#include "JSValueXaml.h"


namespace winrt {
    using namespace Microsoft::ReactNative;
    using namespace Windows::Foundation;
    using namespace Windows::Foundation::Collections;
    using namespace Windows::UI;
    using namespace Windows::UI::Xaml;
    using namespace Windows::UI::Xaml::Controls;
    using namespace Windows::Web::Http;
    using namespace Windows::Web::Http::Headers;
}

namespace winrt::ReactNativeWebView::implementation {

    ReactWebViewManager::ReactWebViewManager() {}

    // IViewManager
    winrt::hstring ReactWebViewManager::Name() noexcept {
        return L"RCTWebView";
    }

    winrt::FrameworkElement ReactWebViewManager::CreateView() noexcept {
      auto view = winrt::ReactNativeWebView::ReactWebView(m_reactContext);
      return view;
    }

    // IViewManagerWithReactContext
    winrt::IReactContext ReactWebViewManager::ReactContext() noexcept {
        return m_reactContext;
    }

    void ReactWebViewManager::ReactContext(IReactContext reactContext) noexcept {
        m_reactContext = reactContext;
    }

    // IViewManagerWithNativeProperties
    IMapView<hstring, ViewManagerPropertyType> ReactWebViewManager::NativeProps() noexcept {
        auto nativeProps = winrt::single_threaded_map<hstring, ViewManagerPropertyType>();
        nativeProps.Insert(L"source", ViewManagerPropertyType::Map);
        nativeProps.Insert(L"backgroundColor", ViewManagerPropertyType::Color);
        nativeProps.Insert(L"messagingEnabled", ViewManagerPropertyType::Boolean);
        return nativeProps.GetView();
    }

    void ReactWebViewManager::UpdateProperties(
        FrameworkElement const& view,
        IJSValueReader const& propertyMapReader) noexcept {
        auto control = view.as<winrt::UserControl>();
        auto content = control.Content();
        auto webView = content.as<winrt::WebView>();
        const JSValueObject& propertyMap = JSValueObject::ReadFrom(propertyMapReader);

        for (auto const& pair : propertyMap) {
            auto const& propertyName = pair.first;
            auto const& propertyValue = pair.second;
            if (propertyValue.IsNull()) continue;

            if (propertyName == "source") {
                auto const& srcMap = propertyValue.AsObject();
                if (srcMap.find("uri") != srcMap.end()) {
                    auto uriString = srcMap.at("uri").AsString();
                    if (uriString.length() == 0) {
                        continue;
                    }

                    bool isPackagerAsset = false;
                    if (srcMap.find("__packager_asset") != srcMap.end()) {
                        isPackagerAsset = srcMap.at("__packager_asset").AsBoolean();
                    }
                    if (isPackagerAsset && uriString.find("file://") == 0) {
                        auto bundleRootPath = winrt::to_string(ReactNativeHost().InstanceSettings().BundleRootPath());
                        uriString.replace(0, 7, bundleRootPath.empty() ? "ms-appx-web:///Bundle/" : bundleRootPath);
                    }

                    if (srcMap.find("method") != srcMap.end() && srcMap.at("method").AsString() == "POST")
                    {
                        auto httpRequest =
                            winrt::HttpRequestMessage(winrt::HttpMethod::Post(), winrt::Uri(to_hstring(uriString)));
                        auto formBody = srcMap.at("body").AsString();
                        if (srcMap.find("headers") != srcMap.end() &&
                            srcMap.at("headers").AsObject().find("content-type") !=
                                srcMap.at("headers").AsObject().end() &&
                            srcMap.at("headers").AsObject().at("content-type") == "application/x-www-form-urlencoded")
                        {
                            auto formContent = winrt::single_threaded_observable_map<winrt::hstring, winrt::hstring>();
                            auto counter = 0;
                            auto current = formBody.find_first_of("&");
                            while (counter <= formBody.find_last_of("&"))
                            {
                                auto keyValueSeparator = formBody.substr(counter, counter + current).find('=');
                                if (keyValueSeparator <= current)
                                {
                                    auto key = winrt::to_hstring(formBody.substr(counter, keyValueSeparator));
                                    auto value = winrt::to_hstring(formBody.substr(
                                        keyValueSeparator + counter + 1, current - keyValueSeparator - 1));
                                    formContent.Insert(key, value);
                                }
                                counter += current + 1;
                                current = formBody.substr(counter, formBody.size() - counter).find_first_of("&");
                            }
                            httpRequest.Content(winrt::HttpFormUrlEncodedContent(formContent));
                            httpRequest.Headers().Accept().TryParseAdd(L"application/x-www-form-urlencoded");
                        }
                        else
                        {
                            httpRequest.Content(winrt::HttpStringContent(to_hstring(formBody)));
                        }
                        webView.NavigateWithHttpRequestMessage(httpRequest);
                    }
                    else
                    {
                        webView.Navigate(winrt::Uri(to_hstring(uriString)));
                    }
                }
                else if (srcMap.find("html") != srcMap.end()) {
                    auto htmlString = srcMap.at("html").AsString();
                    webView.NavigateToString(to_hstring(htmlString));
                }
            }
            else if (propertyName == "backgroundColor") {
                auto color = propertyValue.To<winrt::Color>();
                webView.DefaultBackgroundColor(color.A==0 ? winrt::Colors::Transparent() : color);
            }
            else if (propertyName == "messagingEnabled") {
              auto messagingEnabled = propertyValue.To<bool>();
              auto reactWebView = view.as<ReactNativeWebView::ReactWebView>();
              reactWebView.SetMessagingEnabled(messagingEnabled);
            }
        }        
    }

    // IViewManagerWithExportedEventTypeConstants
    ConstantProviderDelegate ReactWebViewManager::ExportedCustomBubblingEventTypeConstants() noexcept {
        return nullptr;
    }

    ConstantProviderDelegate ReactWebViewManager::ExportedCustomDirectEventTypeConstants() noexcept {
        return [](winrt::IJSValueWriter const& constantWriter) {
            WriteCustomDirectEventTypeConstant(constantWriter, "LoadingStart");
            WriteCustomDirectEventTypeConstant(constantWriter, "LoadingFinish");
            WriteCustomDirectEventTypeConstant(constantWriter, "LoadingError");
            WriteCustomDirectEventTypeConstant(constantWriter, "Message");
        };
    }

    // IViewManagerWithCommands
    IVectorView<hstring> ReactWebViewManager::Commands() noexcept {
        auto commands = winrt::single_threaded_vector<hstring>();
        commands.Append(L"goForward");
        commands.Append(L"goBack");
        commands.Append(L"reload");
        commands.Append(L"stopLoading");
        commands.Append(L"injectJavaScript");
        return commands.GetView();
    }

    void ReactWebViewManager::DispatchCommand(
        FrameworkElement const& view,
        winrt::hstring const& commandId,
        winrt::IJSValueReader const& commandArgsReader) noexcept {
        auto control = view.as<winrt::UserControl>();
        auto content = control.Content();
        auto webView = content.as<winrt::WebView>();
        auto commandArgs = JSValue::ReadArrayFrom(commandArgsReader);

        if (commandId == L"goForward") {
            if (webView.CanGoForward()) {
                webView.GoForward();
            }
        }
        else if (commandId == L"goBack") {
            if (webView.CanGoBack()) {
                webView.GoBack();
            }
        }
        else if (commandId == L"reload") {
            webView.Refresh();
        }
        else if (commandId == L"stopLoading") {
            webView.Stop();
        }
        else if (commandId == L"injectJavaScript") {
            webView.InvokeScriptAsync(L"eval", { winrt::to_hstring(commandArgs[0].AsString()) });
        } 
    }

} // namespace winrt::ReactWebView::implementation