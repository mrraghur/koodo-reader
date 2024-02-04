import React, { useEffect } from "react";
import toast from "react-hot-toast";

const ShareNotifier: React.FC = () => {
  useEffect(() => {
    const handleShareClick = (event: CustomEvent) => {
      console.log("React: Received shareClicked event:", event.detail);
      toast(`Link copied to clipboard: ${event.detail}`);
    };

    document.addEventListener(
      "shareClicked",
      handleShareClick as EventListener
    );

    return () => {
      document.removeEventListener(
        "shareClicked",
        handleShareClick as EventListener
      );
    };
  }, []);

  return null;
};

export default ShareNotifier;
