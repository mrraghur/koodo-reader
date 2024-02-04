import React from "react";
import RecentBooks from "../../utils/readUtils/recordRecent";
import { ViewerProps, ViewerState } from "./interface";
import HideIcon from "../../assets/icon-hide.png";
import ShareIcon from "../../assets/icon-share.png";
import SaveIcon from "../../assets/icon-save.png";

import { withRouter } from "react-router-dom";
import BookUtil from "../../utils/fileUtils/bookUtil";
import PDFWidget from "../../components/pdfWidget";
import PopupMenu from "../../components/popups/popupMenu";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { handleLinkJump } from "../../utils/readUtils/linkUtil";
import { pdfMouseEvent } from "../../utils/serviceUtils/mouseEvent";
import StorageUtil from "../../utils/serviceUtils/storageUtil";
import PopupBox from "../../components/popups/popupBox";
import { renderHighlighters } from "../../utils/serviceUtils/noteUtil";
import { getPDFIframeDoc } from "../../utils/serviceUtils/docUtil";
import ShareNotifier from "../../components/shareNotifier/shareNotifier";
declare var window: any;
class Viewer extends React.Component<ViewerProps, ViewerState> {
  constructor(props: ViewerProps) {
    super(props);
    this.state = {
      href: "",
      title: "",
      cfiRange: null,
      contents: null,
      rect: null,
      loading: true,
      isDisablePopup: StorageUtil.getReaderConfig("isDisablePopup") === "yes",
      hiddenPages: [],
      isHideHovered: false,
      isShareHovered: false,
    };
  }
  UNSAFE_componentWillMount() {
    this.props.handleFetchBookmarks();
    this.props.handleFetchNotes();
    this.props.handleFetchBooks();
  }
  componentDidMount() {
    let url = document.location.href;
    let firstIndexOfQuestion = url.indexOf("?");
    let lastIndexOfSlash = url.lastIndexOf("/", firstIndexOfQuestion);
    let key = url.substring(lastIndexOfSlash + 1, firstIndexOfQuestion);
    window.localforage.getItem("books").then((result: any) => {
      let book;
      if (this.props.currentBook.key) {
        book = this.props.currentBook;
      } else {
        book =
          result[window._.findIndex(result, { key })] ||
          JSON.parse(localStorage.getItem("tempBook") || "{}");
      }

      document.title = book.name + " - Koodo Reader";
      this.props.handleReadingState(true);
      RecentBooks.setRecent(key);
      this.props.handleReadingBook(book);
      this.setState({ title: book.name + " - Koodo Reader" });
      this.setState({ href: BookUtil.getPDFUrl(book) });
      this.fetchAndApplyHiddenPages(book.key);
    });
    document
      .querySelector(".ebook-viewer")
      ?.setAttribute("style", "height:100%; overflow: hidden;");
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    iframe.onload = () => {
      let doc: any =
        iframe.contentWindow || iframe.contentDocument?.defaultView;
      this.setState({ loading: false });
      pdfMouseEvent();
      doc.document.addEventListener("click", async (event: any) => {
        event.preventDefault();
        await handleLinkJump(event);
      });

      doc.document.addEventListener("mouseup", (event) => {
        if (this.state.isDisablePopup) return;
        if (!doc!.getSelection() || doc!.getSelection().rangeCount === 0)
          return;
        event.preventDefault();
        var rect = doc!.getSelection()!.getRangeAt(0).getBoundingClientRect();
        this.setState({
          rect,
        });
        // iWin.getSelection() && showHighlight(getHightlightCoords());
      });
      doc.addEventListener("contextmenu", (event) => {
        if (!this.state.isDisablePopup) return;
        if (!doc!.getSelection() || doc!.getSelection().rangeCount === 0)
          return;
        event.preventDefault();
        var rect = doc!.getSelection()!.getRangeAt(0).getBoundingClientRect();
        this.setState({
          rect,
        });
      });

      setTimeout(() => {
        this.handleHighlight();
        let iWin = getPDFIframeDoc();
        if (!iWin) return;
        if (!iWin.PDFViewerApplication.eventBus) return;
        iWin.PDFViewerApplication.eventBus.on(
          "pagechanging",
          this.handleHighlight
        );
      }, 3000);
    };
  }
  handleHighlight = () => {
    let highlighters: any = this.props.notes;
    if (!highlighters) return;
    let highlightersByChapter = highlighters;

    renderHighlighters(
      highlightersByChapter,
      this.props.currentBook.format,
      this.handleNoteClick
    );
  };
  handleNoteClick = (event: Event) => {
    this.props.handleNoteKey((event.target as any).dataset.key);
    this.props.handleMenuMode("note");
    this.props.handleOpenMenu(true);
  };
  toggleCurrentPageVisibility = () => {
    const currentPage = this.getCurrentPageNumber();
    if (currentPage === null) {
      console.error("Unable to get current page number");
      return;
    }

    this.setState(
      (prevState) => ({
        hiddenPages: prevState.hiddenPages.includes(currentPage)
          ? prevState.hiddenPages.filter((page) => page !== currentPage)
          : [...prevState.hiddenPages, currentPage],
      }),
      () => {
        const iframe = document.getElementById(
          "pdfViewerIframe"
        ) as HTMLIFrameElement;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              action: "setHiddenPages",
              hiddenPages: this.state.hiddenPages,
            },
            "*" // We need to choose a specific target origin in production for security
          );
        }
        toast.success(`Page ${currentPage} is hidden`, { duration: 2000 });
      }
    );
  };
  handleShareCurrentPage = () => {
    const currentPage = this.getCurrentPageNumber();
    if (currentPage === null) {
      console.error("Unable to get current page number");
      return;
    }

    const urlToShare = `${document.URL}#page=${currentPage}`;

    navigator.clipboard
      .writeText(urlToShare)
      .then(() => {
        toast.success("Link copied to clipboard!", { duration: 2000 });
      })
      .catch((err) => {
        toast.error("Failed to copy the link", { duration: 2000 });
      });
  };
  getCurrentPageNumber = () => {
    const iframe = document.getElementById(
      "pdfViewerIframe"
    ) as HTMLIFrameElement;
    if (iframe?.contentWindow?.PDFViewerApplication) {
      console.log(iframe.contentWindow.PDFViewerApplication.page);
      return iframe.contentWindow.PDFViewerApplication.page;
    }
    return null;
  };
  saveHiddenPages = () => {
    const { hiddenPages } = this.state;
    const bookKey = this.props.currentBook.key;

    window.localforage
      .getItem("hiddenPages")
      .then((data) => {
        const hiddenPagesMap = data || {};
        hiddenPagesMap[bookKey] = hiddenPages;

        window.localforage
          .setItem("hiddenPages", hiddenPagesMap)
          .then(() => {
            console.log("Hidden pages info saved.");
          })
          .catch((error) => {
            console.error("Error saving hidden pages:", error);
          });
      })
      .catch((error) => {
        console.error("Error fetching hidden pages:", error);
      });
  };
  fetchAndApplyHiddenPages = (bookKey) => {
    window.localforage
      .getItem("hiddenPages")
      .then((data) => {
        if (data && data[bookKey]) {
          this.setState({ hiddenPages: data[bookKey] }, () => {
            const iframe = document.getElementById(
              "pdfViewerIframe"
            ) as HTMLIFrameElement;
            if (!iframe || !iframe.contentWindow) return;

            const message = {
              action: "setHiddenPages",
              hiddenPages: this.state.hiddenPages,
            };
            iframe.addEventListener(
              "load",
              () => {
                if (iframe.contentWindow) {
                  iframe.contentWindow.postMessage(message, "*");
                } else {
                  console.error("Unable to access iframe contentWindow");
                }
              },
              { once: true }
            );
          });
        }
      })
      .catch((error) => {
        console.error("Error fetching hidden pages:", error);
      });
  };
  getButtonStyle(isHovered) {
    return {
      color: "#fcfcfc",
      fontSize: "20px",
      backgroundColor: isHovered ? "#a0a0a0" : "transparent",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background-color 0.3s",
    };
  }

  render() {
    const widgetStyle: React.CSSProperties = {
      position: "fixed",
      top: "50px",
      right: "50px",
      width: "80px",
      height: "30px",
      borderRadius: "20px",
      backgroundColor: "#8b8b8b",
      zIndex: 1000,
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      cursor: "pointer",
      padding: "8px 15px",
      transition: "width 0.3s ease-in-out",
    };

    const iconStyle: React.CSSProperties = {
      width: "20px",
      height: "20px",
    };

    return (
      <div className="ebook-viewer" id="page-area">
        {!this.state.loading && (
          <PopupMenu
            {...{
              rendition: {
                on: (status: string, callback: any) => {
                  callback();
                },
              },
              rect: this.state.rect,
              chapterDocIndex: 0,
              chapter: "0",
            }}
          />
        )}
        {this.props.isOpenMenu &&
        (this.props.menuMode === "dict" ||
          this.props.menuMode === "trans" ||
          this.props.menuMode === "note") ? (
          <PopupBox
            {...{
              rendition: {
                on: (status: string, callback: any) => {
                  callback();
                },
              },
              rect: this.state.rect,
              chapterDocIndex: 0,
              chapter: "0",
            }}
          />
        ) : null}
        <div style={widgetStyle}>
          <button
            style={this.getButtonStyle(this.state.isHideHovered)}
            onMouseEnter={() => this.setState({ isHideHovered: true })}
            onMouseLeave={() => this.setState({ isHideHovered: false })}
            onClick={this.toggleCurrentPageVisibility}
          >
            <img src={HideIcon} alt="Hide" style={iconStyle} />
          </button>
          <button
            style={this.getButtonStyle(this.state.isShareHovered)}
            onMouseEnter={() => this.setState({ isShareHovered: true })}
            onMouseLeave={() => this.setState({ isShareHovered: false })}
            onClick={this.handleShareCurrentPage}
          >
            <img src={ShareIcon} alt="Share" style={iconStyle} />
          </button>
          <button onClick={this.saveHiddenPages}>
            <img src={SaveIcon} alt="Save" style={iconStyle} />
          </button>
        </div>
        <iframe
          id="pdfViewerIframe"
          src={this.state.href}
          title={this.state.title}
          width="100%"
          height="100%"
        >
          Loading
        </iframe>
        <PDFWidget /> <Toaster />
        <ShareNotifier />
      </div>
    );
  }
}
export default withRouter(Viewer as any);
