
package com.reactnativecommunity.webview;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Parcelable;
import android.provider.MediaStore;
import android.support.annotation.RequiresApi;
import android.util.Log;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;

import static android.app.Activity.RESULT_OK;

public class RNCWebViewModule extends ReactContextBaseJavaModule implements ActivityEventListener {

  private final ReactApplicationContext reactContext;
  private RNCWebViewPackage aPackage;

  private static final int PICKER = 1;
  private static final int PICKER_LEGACY = 3;

  private ValueCallback<Uri> filePathCallbackLegacy;
  private ValueCallback<Uri[]> filePathCallback;
  private Uri outputFileUri;

  final String DEFAULT_MIME_TYPES = "*/*";

  public RNCWebViewModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    reactContext.addActivityEventListener(this);
  }

  @Override
  public String getName() {
    return "RNCWebView";
  }

  @ReactMethod
  public void isFileUploadSupported(final Promise promise) {
      Boolean result = false;
      int current = Build.VERSION.SDK_INT;
      if (current >= Build.VERSION_CODES.LOLLIPOP) {
          result = true;
      }
      if (current >= Build.VERSION_CODES.JELLY_BEAN && current <= Build.VERSION_CODES.JELLY_BEAN_MR2) {
          result = true;
      }
      promise.resolve(result);
  }

  public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {

    if (filePathCallback == null && filePathCallbackLegacy == null) {
        return;
    }

    // based off of which button was pressed, we get an activity result and a file
    // the camera activity doesn't properly return the filename* (I think?) so we use
    // this filename instead
    switch (requestCode) {
    case PICKER:
        if (resultCode != RESULT_OK) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
            }
        } else {
            Uri result[] = this.getSelectedFiles(data, resultCode);
            if (result != null) {
                filePathCallback.onReceiveValue(result);
            } else {
                filePathCallback.onReceiveValue(new Uri[] { outputFileUri });
            }
        }
        break;
    case PICKER_LEGACY:
        Uri result = resultCode != Activity.RESULT_OK ? null : data == null ? outputFileUri : data.getData();
        filePathCallbackLegacy.onReceiveValue(result);
        break;

    }
    filePathCallback = null;
    filePathCallbackLegacy= null;
    outputFileUri = null;
  }

  public void onNewIntent(Intent intent) {
  }

  private Uri[] getSelectedFiles(Intent data, int resultCode) {
    if (data == null) {
        return null;
    }

    // we have one file selected
    if (data.getData() != null) {
        if (resultCode == RESULT_OK && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            return WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        } else {
            return null;
        }
    }

    // we have multiple files selected
    if (data.getClipData() != null) {
        final int numSelectedFiles = data.getClipData().getItemCount();
        Uri[] result = new Uri[numSelectedFiles];
        for (int i = 0; i < numSelectedFiles; i++) {
            result[i] = data.getClipData().getItemAt(i).getUri();
        }
        return result;
    }
    return null;
  }

  public void startPhotoPickerIntent(ValueCallback<Uri> filePathCallback, String acceptType) {
      filePathCallbackLegacy = filePathCallback;

      Intent fileChooserIntent = getFileChooserIntent(acceptType);
      Intent chooserIntent = Intent.createChooser(fileChooserIntent, "");

      ArrayList<Parcelable> extraIntents = new ArrayList<>();
      if (acceptsImages(acceptType)) {
          extraIntents.add(getPhotoIntent());
      }
      if (acceptsVideo(acceptType)) {
          extraIntents.add(getVideoIntent());
      }
      chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents.toArray(new Parcelable[]{}));

      if (chooserIntent.resolveActivity(getCurrentActivity().getPackageManager()) != null) {
          getCurrentActivity().startActivityForResult(chooserIntent, PICKER_LEGACY);
      } else {
          Log.w("RNCWebViewModule", "there is no Activity to handle this Intent");
      }
  }

  @RequiresApi(api = Build.VERSION_CODES.LOLLIPOP)
  public boolean startPhotoPickerIntent(final ValueCallback<Uri[]> callback, final Intent intent, final String[] acceptTypes, final boolean allowMultiple) {
    filePathCallback = callback;

    ArrayList<Parcelable> extraIntents = new ArrayList<>();
    if (acceptsImages(acceptTypes)) {
      extraIntents.add(getPhotoIntent());
    }
    if (acceptsVideo(acceptTypes)) {
      extraIntents.add(getVideoIntent());
    }

    Intent fileSelectionIntent = getFileChooserIntent(acceptTypes, allowMultiple);

    Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
    chooserIntent.putExtra(Intent.EXTRA_INTENT, fileSelectionIntent);
    chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents.toArray(new Parcelable[]{}));

    if (chooserIntent.resolveActivity(getCurrentActivity().getPackageManager()) != null) {
        getCurrentActivity().startActivityForResult(chooserIntent, PICKER);
    } else {
        Log.w("RNCWebViewModule", "there is no Activity to handle this Intent");
    }

    return true;
  }

  public RNCWebViewPackage getPackage() {
    return this.aPackage;
  }

  public void setPackage(RNCWebViewPackage aPackage) {
    this.aPackage = aPackage;
  }

  private Intent getPhotoIntent() {
    Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
    outputFileUri = getOutputUri(MediaStore.ACTION_IMAGE_CAPTURE);
    intent.putExtra(MediaStore.EXTRA_OUTPUT, outputFileUri);
    return intent;
  }

  private Intent getVideoIntent() {
    Intent intent = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
    Uri outputVideoUri = getOutputUri(MediaStore.ACTION_VIDEO_CAPTURE);
    intent.putExtra(MediaStore.EXTRA_OUTPUT, outputVideoUri);
    return intent;
  }

  private Intent getFileChooserIntent(String acceptTypes) {
    String _acceptTypes = acceptTypes;
    if (acceptTypes.isEmpty()) {
      _acceptTypes = DEFAULT_MIME_TYPES;
    }
    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType(_acceptTypes);
    return intent;
  }

  private Intent getFileChooserIntent(String[] acceptTypes, boolean allowMultiple) {
    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("*/*");
    intent.putExtra(Intent.EXTRA_MIME_TYPES, getAcceptedMimeType(acceptTypes));
    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple);
    return intent;
  }

  private Boolean acceptsImages(String types) {
    return types.isEmpty() || types.toLowerCase().contains("image");
  }
  private Boolean acceptsImages(String[] types) {
    return isArrayEmpty(types) || arrayContainsString(types, "image");
  }

  private Boolean acceptsVideo(String types) {
    return types.isEmpty() || types.toLowerCase().contains("video");
  }
  private Boolean acceptsVideo(String[] types) {
    return isArrayEmpty(types) || arrayContainsString(types, "video");
  }

  private Boolean arrayContainsString(String[] array, String pattern){
    for(String content : array){
        if(content.contains(pattern)){
            return true;
        }
    }
    return false;
  }

  private String[] getAcceptedMimeType(String[] types) {
    if (isArrayEmpty(types)) {
        return new String[]{DEFAULT_MIME_TYPES};
    }
    return types;
  }

  private Uri getOutputUri(String intentType) {
    File capturedFile = null;
    try {
        capturedFile = getCapturedFile(intentType);
    } catch (IOException e) {
        Log.e("CREATE FILE", "Error occurred while creating the File", e);
        e.printStackTrace();
    }
    return Uri.fromFile(capturedFile);
  }

  private File getCapturedFile(String intentType) throws IOException {
    String prefix = "";
    String suffix = "";
    String dir = "";

    if (intentType == MediaStore.ACTION_IMAGE_CAPTURE) {
      prefix = "image-";
      suffix = ".jpg";
      dir = Environment.DIRECTORY_PICTURES;
    } else if (intentType == MediaStore.ACTION_VIDEO_CAPTURE) {
      prefix = "video-";
      suffix = ".mp4";
      dir = Environment.DIRECTORY_MOVIES;
    }

    // only this Directory works on all tested Android versions
    // ctx.getExternalFilesDir(dir) was failing on Android 5.0 (sdk 21)
    File storageDir = Environment.getExternalStoragePublicDirectory(dir);

    return new File(storageDir, prefix + String.valueOf(System.currentTimeMillis()) + suffix);
  }

  private Boolean isArrayEmpty(String[] arr) {
    // when our array returned from getAcceptTypes() has no values set from the webview
    // i.e. <input type="file" />, without any "accept" attr
    // will be an array with one empty string element, afaik
    return arr.length == 0 || (arr.length == 1 && arr[0].length() == 0);
  }
}
