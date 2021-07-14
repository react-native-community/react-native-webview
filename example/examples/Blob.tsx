import React, {Component} from 'react';
import {Button, Linking, Text, View} from 'react-native';
import WebView, { WebViewEvent } from 'react-native-webview';

const HTML = `
<!DOCTYPE html>\n
<html>
<style>
    a {
        font-size: 30px;
        margin: 20px;
    }
</style>
<body>
    <a id="download_blob" download="red_dot.png">blob link test</a>
    <a id="download_base64" download="red_dot.png">
       base64 image link test
    </a>
    <script>
        var url = 'data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=='
        fetch(url).then(function(response) {
          return response.blob().then(blob => {
              document.getElementById('download_blob').href = URL.createObjectURL(blob)
               var reader = new FileReader();
               reader.readAsDataURL(blob);
               reader.onloadend = function() {
                  document.getElementById('download_base64').href = reader.result
               }
          })
        });
    </script>
</html>
`


type Props = {};
type State = {};

export default class Blob extends Component<Props, State> {
  constructor(props) {
    super(props);
    this.webView = React.createRef();
  }

  state = {};

  onDownloadUnsupportedURL = ({ nativeEvent }: { nativeEvent: WebViewEvent } ) => {
    console.log(nativeEvent)
  };


  render() {
    return (
      <View style={{ height: 120 }}>
        <WebView
          onDownloadUnsupportedURL={this.onDownloadUnsupportedURL}
          source={{ html: HTML }}
          automaticallyAdjustContentInsets={false}
        />
      </View>
    );
  }
}