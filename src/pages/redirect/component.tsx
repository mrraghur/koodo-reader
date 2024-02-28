import React from "react";
import "./manager.css";
import { RedirectProps, RedirectState } from "./interface";
import { Trans } from "react-i18next";
import { getParamsFromUrl } from "../../utils/syncUtils/common";
import { withRouter } from "react-router-dom";
import StorageUtil from "../../utils/serviceUtils/storageUtil";
import Lottie from "react-lottie";
import animationSuccess from "../../assets/lotties/success.json";
import toast, { Toaster } from "react-hot-toast";
const successOptions = {
  loop: false,
  autoplay: true,
  animationData: animationSuccess,
  rendererSettings: {
    preserveAspectRatio: "xMidYMid slice",
  },
};

class Redirect extends React.Component<RedirectProps, RedirectState> {
  timer!: NodeJS.Timeout;
  constructor(props: RedirectProps) {
    super(props);
    this.state = {
      isAuthed: false,
      isError: false,
      isCopied: false,
      token: "",
    };
  }
  handleFinish = () => {
    this.props.handleLoadingDialog(false);
    alert("数据恢复成功");
  };
  showMessage = (message: string) => {
    toast(this.props.t(message));
  };
  componentDidMount() {
    this.handleGoogleDriveConfirm();
    //判断是否是获取token后的回调页面
    let url = document.location.href;
    if (document.location.hash === "#/" && url.indexOf("code") === -1) {
      this.props.history.push("/manager/home");
    }
    if (url.indexOf("error") > -1) {
      this.setState({ isError: true });
      return false;
    }
    if (url.indexOf("code") > -1) {
      let params: any = getParamsFromUrl();
      this.setState({ token: params.code });
      this.setState({ isAuthed: true });
      return false;
    }
    if (url.indexOf("access_token") > -1) {
      let params: any = getParamsFromUrl();
      this.setState({ token: params.access_token });
      this.setState({ isAuthed: true });
      return false;
    }
  }
  handleGoogleDriveConfirm = async () => {
    if (localStorage.getItem("googleDriveConfirmed")) {
      return;
    }
    // Parse URL hash to extract access token
    const hash = window.location.hash.substring(1);
    const hashParams = new Map<string, string>();
    hash.split("&").forEach((item) => {
      let [key, value] = item.split("=");
      if (key.startsWith("/")) key = key.substring(1);
      hashParams.set(key, value);
    });

    // Retrieve and store access token, then mark confirmation in localStorage
    let accessToken = hashParams.get("access_token");
    if (accessToken === undefined) {
      console.error("Access token not found");
    } else {
      StorageUtil.setReaderConfig(`googledrive_token`, accessToken);
      localStorage.setItem("googleDriveConfirmed", "true");
      window.location.href = "/";
    }
  };
  render() {
    if (this.state.isError || this.state.isAuthed) {
      return (
        <div className="backup-page-finish-container">
          <div className="backup-page-finish">
            {this.state.isAuthed ? (
              <Lottie options={successOptions} height={80} width={80} />
            ) : (
              <span className="icon-close auth-page-close-icon"></span>
            )}

            <div className="backup-page-finish-text">
              <Trans>
                {this.state.isAuthed
                  ? "Authorisation successful"
                  : "Authorisation failed"}
              </Trans>
            </div>
            {/* {this.state.isAuthed ? (
              <div
                className="token-dialog-token-text"
                onClick={() => {
                  copy(this.state.token);
                  this.setState({ isCopied: true });
                }}
              >
                {this.state.isCopied ? (
                  <Trans>Copied</Trans>
                ) : (
                  <Trans>Copy token</Trans>
                )}
              </div>
            ) : null} */}
          </div>
        </div>
      );
    }

    return (
      <div className="manager">
        <div className="empty-page-info-container" style={{ margin: 100 }}>
          <div className="empty-page-info-main">
            <Trans>It seems like you're lost</Trans>
          </div>
          <div
            className="empty-page-info-sub"
            onClick={() => {
              this.props.history.push("/manager/home");
            }}
            style={{ marginTop: 10, cursor: "pointer" }}
          >
            <Trans>Return to home</Trans>
          </div>
        </div>
        <img
          src={
            StorageUtil.getReaderConfig("appSkin") === "night" ||
            (StorageUtil.getReaderConfig("appSkin") === "system" &&
              StorageUtil.getReaderConfig("isOSNight") === "yes")
              ? "./assets/empty_light.svg"
              : "./assets/empty.svg"
          }
          alt=""
          className="empty-page-illustration"
        />
        <Toaster />
      </div>
    );
  }
}

export default withRouter(Redirect as any);
