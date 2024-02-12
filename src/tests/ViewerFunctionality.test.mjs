import { Builder, By, until } from "selenium-webdriver";
import assert from "assert";

async function setupDriver() {
  return new Builder().forBrowser("firefox").build();
}

async function testHideFeature(driver, bookKey) {
  // Interact with the hide button
  const hideButton = await driver.wait(
    until.elementLocated(By.className("hide-button")),
    10000
  );
  await driver.wait(until.elementIsVisible(hideButton), 10000);
  await hideButton.click();

  // After clicking the hide button, check the hidden pages
  // In our case, the first page gets hidden (if we donot scroll down when the book is opened)
  // So the hiddenPages[bookKey] = [1] should be the expected value
  const expectedHiddenPages = [1];
  await driver
    .executeScript((bookKey) => {
      return new Promise((resolve) => {
        localforage.getItem("hiddenPages").then((hiddenPages) => {
          if (hiddenPages && Array.isArray(hiddenPages[bookKey])) {
            // Ensure we have an array for the bookKey and sort it
            resolve(hiddenPages[bookKey].sort((a, b) => a - b));
          } else {
            // Return an empty array if not found
            resolve([]);
          }
        });
      });
    }, bookKey)
    .then((actualHiddenPages) => {
      assert.deepStrictEqual(
        actualHiddenPages,
        expectedHiddenPages,
        "Hidden pages for the book do not match the expected."
      );
      console.log("Hidden pages for the book verified successfully.");
    })
    .catch((error) => {
      console.error("Error verifying hidden pages for the book:", error);
    });
}

async function testFeatures() {
  let driver = await setupDriver();
  try {
    // Navigate to home page
    await driver.get("http://localhost:3000/#/manager/home");

    // Upload a PDF file
    const filePath = "/home/harsh/Desktop/mtp/2103.14756.pdf";
    await driver.findElement(By.css("input[type='file']")).sendKeys(filePath);

    // Ensure book list is visible and open a book
    await driver.wait(until.elementLocated(By.css(".book-list-item")), 10000);
    const bookItem = (await driver.findElements(By.css(".book-item-cover")))[0]; // Select the first book
    // Extract key of the selected book
    const bookKey = (await bookItem.getAttribute("class")).match(
      /book-item-(\d+)/
    )[1];
    assert(bookKey, "Book key not found.");
    await driver.findElement(By.css(`.book-item-${bookKey}`)).click();

    // Wait for and switch to the tab where the book is opened
    await driver.sleep(3000);
    const windows = await driver.getAllWindowHandles();
    await driver.switchTo().window(windows[1]); // Assume the tab is the second one of all the tabs

    // Access content within iframe and get the current page number
    await driver
      .switchTo()
      .frame(
        await driver.wait(until.elementLocated(By.id("pdfViewerIframe")), 10000)
      );
    const currentPageNumber = await driver.executeScript(
      () => window.PDFViewerApplication?.page || null
    );
    console.log(`Current page number: ${currentPageNumber}`);
    await driver.switchTo().defaultContent(); // Switch back to default content

    await testHideFeature(driver, bookKey);
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await driver.quit();
  }
}

testFeatures().catch(console.error);
