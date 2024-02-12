import React from "react";
import RecentBooks from "../../utils/readUtils/recordRecent";
import { ViewerProps, ViewerState } from "./interface";
import HideIcon from "../../assets/icon-hide.png";
import ShareIcon from "../../assets/icon-share.png";

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

    // Add shareClicked event listener
    this.handleShareClick = this.handleShareClick.bind(this);
    document.addEventListener("shareClicked", this.handleShareClick);
  }
  componentWillUnmount() {
    // Remove shareClicked event listener
    document.removeEventListener("shareClicked", this.handleShareClick);
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
  hideCurrentPage = () => {
    const currentPage = this.getCurrentPageNumber();

    if (this.state.hiddenPages.includes(currentPage)) {
      toast.error(`Page ${this.getCurrentPageNumber()} is already hidden`, {
        duration: 2000,
      });
    } else {
      this.setState(
        (prevState) => ({
          hiddenPages: [...prevState.hiddenPages, currentPage],
        }),
        () => {
          this.saveHiddenPages();
          this.applyHiddenPagesToViewer();

          const totalPages = this.getTotalPageNumber();
          if (this.state.hiddenPages.length === totalPages) {
            this.displayAllPagesHiddenMessage();
          }
        }
      );
    }
  };

  applyHiddenPagesToViewer = () => {
    const iframe = document.getElementById(
      "pdfViewerIframe"
    ) as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          action: "setHiddenPages",
          hiddenPages: this.state.hiddenPages,
        },
        "*"
      );
    }
    toast.success(`Page ${this.getCurrentPageNumber()} is now hidden`, {
      duration: 2000,
    });
  };
  displayAllPagesHiddenMessage = () => {
    const iframe = document.getElementById(
      "pdfViewerIframe"
    ) as HTMLIFrameElement;
    if (!iframe || !iframe.contentDocument) return;

    const existingMessage = iframe.contentDocument.getElementById(
      "allPagesHiddenMessage"
    );
    if (existingMessage) existingMessage.remove();

    const messageDiv = iframe.contentDocument.createElement("div");
    messageDiv.id = "allPagesHiddenMessage";
    messageDiv.style.position = "absolute";
    messageDiv.style.top = "50%";
    messageDiv.style.left = "50%";
    messageDiv.style.transform = "translate(-50%, -50%)";
    messageDiv.style.fontSize = "20px";
    messageDiv.style.color = "#8b8b8b";
    messageDiv.style.zIndex = "1000";
    messageDiv.textContent = "All pages are hidden.";
    iframe.contentDocument.body.appendChild(messageDiv);
  };
  getTotalPageNumber = () => {
    const iframe = document.getElementById(
      "pdfViewerIframe"
    ) as HTMLIFrameElement;
    return (
      iframe?.contentWindow?.PDFViewerApplication?.pdfDocument?.numPages || 0
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
  handleShareClick(event) {
    console.log("React: Received shareClicked event:", event.detail);
    toast(`Link copied to clipboard: ${event.detail}`);
  }
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
            className="hide-button"
            style={this.getButtonStyle(this.state.isHideHovered)}
            onMouseEnter={() => this.setState({ isHideHovered: true })}
            onMouseLeave={() => this.setState({ isHideHovered: false })}
            onClick={this.hideCurrentPage}
          >
            <img src={HideIcon} alt="Hide" style={iconStyle} />
          </button>
          <button
            className="share-button"
            style={this.getButtonStyle(this.state.isShareHovered)}
            onMouseEnter={() => this.setState({ isShareHovered: true })}
            onMouseLeave={() => this.setState({ isShareHovered: false })}
            onClick={this.handleShareCurrentPage}
          >
            <img src={ShareIcon} alt="Share" style={iconStyle} />
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
      </div>
    );
  }
}
export default withRouter(Viewer as any);
