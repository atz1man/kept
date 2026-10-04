import Foundation
import Capacitor
import UIKit
import Vision
import VisionKit

/// Apple's document camera, and Apple's text recognition, on the device.
///
/// The document camera finds the receipt's edges as the camera points at it,
/// takes the picture when it is steady, and hands back the page already
/// flattened — the step `lib/flatten.ts` does after the fact on the web.
/// Vision then reads it: the same engine that reads text in Photos and Notes,
/// far stronger on a faded thermal slip than anything that can be shipped in
/// a web view. Neither sends anything anywhere.
///
/// What comes back is each line Vision read and where it sat on the page, not
/// one joined string: a till slip's labels and figures are separate columns,
/// and the JavaScript puts them back on the lines they share with the same
/// rule it uses for a PDF (`pdfLines`), which is tested there.
@objc(ReceiptScannerPlugin)
public class ReceiptScannerPlugin: CAPPlugin, CAPBridgedPlugin, VNDocumentCameraViewControllerDelegate {
    public let identifier = "ReceiptScannerPlugin"
    public let jsName = "ReceiptScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]

    /// A receipt is a page or two; a long one photographed in parts, four.
    private static let maxPages = 4
    private var pending: CAPPluginCall?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": VNDocumentCameraViewController.isSupported])
    }

    @objc func scan(_ call: CAPPluginCall) {
        guard VNDocumentCameraViewController.isSupported else {
            call.reject("The document camera is not available on this device.", "UNAVAILABLE")
            return
        }
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("Nothing to show the camera from.", "UNAVAILABLE")
                return
            }
            self.pending = call
            let camera = VNDocumentCameraViewController()
            camera.delegate = self
            presenter.present(camera, animated: true)
        }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: true)
        pending?.reject("The scan was cancelled.", "CANCELLED")
        pending = nil
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
        controller.dismiss(animated: true)
        pending?.reject(error.localizedDescription, "FAILED")
        pending = nil
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        controller.dismiss(animated: true)
        guard let call = pending else { return }
        pending = nil
        let images = (0..<min(scan.pageCount, Self.maxPages)).map { scan.imageOfPage(at: $0) }
        DispatchQueue.global(qos: .userInitiated).async {
            let pages: [[String: Any]] = images.map { image in
                [
                    "lines": Self.read(image),
                    // The page's size, so its fractions can be put back in proportion.
                    "width": Double(image.size.width),
                    "height": Double(image.size.height),
                    // The first page is kept with the receipt as proof of purchase, as a camera photo is.
                    "jpeg": image.jpegData(compressionQuality: 0.8)?.base64EncodedString() ?? ""
                ]
            }
            call.resolve(["pages": pages])
        }
    }

    /// Each line of text on the page, and where it is: x right and y UP from
    /// the bottom-left, as fractions of the page — Vision's own coordinates,
    /// which are the PDF's, so the same line rule reads both.
    static func read(_ image: UIImage) -> [[String: Any]] {
        guard let picture = image.cgImage else { return [] }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        // Prices, codes and dates, not prose: correction "fixes" 0O and 1l the wrong way.
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-GB"]
        let handler = VNImageRequestHandler(cgImage: picture, orientation: .up, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return []
        }
        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        return observations.compactMap { observation in
            guard let best = observation.topCandidates(1).first else { return nil }
            let box = observation.boundingBox
            return [
                "text": best.string,
                "x": Double(box.minX),
                "y": Double(box.minY),
                "width": Double(box.width),
                "height": Double(box.height),
                "confidence": Double(best.confidence)
            ]
        }
    }
}
