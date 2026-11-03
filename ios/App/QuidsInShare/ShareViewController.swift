import UIKit
import UniformTypeIdentifiers

// The share extension: "Quids In" in the share sheet of Mail, Files, Photos
// and Safari.
//
// It takes ONE thing — a PDF of an order, a screenshot or photo of a receipt,
// a saved email, or the selected text of an order email — and puts it in the
// App Group container's Inbox for the app to collect the next time it is
// opened (packages/share-inbox). Apple does not let a share extension open
// its app, so it says what happens next and gets out of the way. It reads
// nothing, uploads nothing and keeps one item: a second share replaces the
// first, which is the one that was never collected.

final class ShareViewController: UIViewController {
    /// The names packages/share-inbox reads. Held together by test/share-extension.test.ts.
    static let inboxFolder = "Inbox"
    static let noteName = "shared.json"
    static let dataName = "shared.data"
    /// A PDF bigger than this is not an order confirmation; it also has to cross the app's bridge as base64.
    static let maxBytes = 15 * 1024 * 1024

    /// What is accepted, in the order it is preferred when one share carries several.
    static let accepted: [(type: UTType, mime: String, ext: String)] = [
        (.pdf, "application/pdf", "pdf"),
        (.emailMessage, "message/rfc822", "eml"),
        (.html, "text/html", "html"),
        (.jpeg, "image/jpeg", "jpg"),
        (.png, "image/png", "png"),
        (.heic, "image/heic", "heic"),
        (.plainText, "text/plain", "txt"),
    ]

    private let titleLabel = UILabel()
    private let bodyLabel = UILabel()
    private let doneButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        titleLabel.font = .preferredFont(forTextStyle: .title2)
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.numberOfLines = 0
        bodyLabel.font = .preferredFont(forTextStyle: .body)
        bodyLabel.adjustsFontForContentSizeCategory = true
        bodyLabel.textColor = .secondaryLabel
        bodyLabel.numberOfLines = 0
        doneButton.setTitle("Done", for: .normal)
        doneButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        doneButton.addTarget(self, action: #selector(done), for: .touchUpInside)
        doneButton.isHidden = true
        let stack = UIStackView(arrangedSubviews: [titleLabel, bodyLabel, doneButton])
        stack.axis = .vertical
        stack.spacing = 12
        stack.alignment = .leading
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        show("Saving for Quids In…", nil, finished: false)
        receive()
    }

    private func show(_ title: String, _ body: String?, finished: Bool) {
        titleLabel.text = title
        bodyLabel.text = body
        bodyLabel.isHidden = body == nil
        doneButton.isHidden = !finished
    }

    @objc private func done() {
        extensionContext?.completeRequest(returningItems: nil)
    }

    private func receive() {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        for kind in Self.accepted {
            guard let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(kind.type.identifier) }) else { continue }
            if kind.type == .plainText {
                provider.loadItem(forTypeIdentifier: kind.type.identifier, options: nil) { item, _ in
                    let text: String? = (item as? String) ?? (item as? Data).flatMap { String(data: $0, encoding: .utf8) }
                        ?? (item as? URL).flatMap { try? String(contentsOf: $0, encoding: .utf8) }
                    self.finish(text?.data(using: .utf8), kind: kind, name: "order.txt")
                }
            } else {
                provider.loadDataRepresentation(forTypeIdentifier: kind.type.identifier) { data, _ in
                    self.finish(data, kind: kind, name: provider.suggestedName.map { "\($0).\(kind.ext)" } ?? "shared.\(kind.ext)")
                }
            }
            return
        }
        DispatchQueue.main.async {
            self.show("Quids In can’t read this", "Share a PDF, a picture of a receipt, or the text of an order email.", finished: true)
        }
    }

    private func finish(_ data: Data?, kind: (type: UTType, mime: String, ext: String), name: String) {
        let outcome: (String, String) = {
            guard let data, !data.isEmpty else {
                return ("Nothing to save", "That share arrived empty. Try sharing it again, or paste the order into Quids In.")
            }
            guard data.count <= Self.maxBytes else {
                return ("That’s too big to read", "Quids In reads files up to 15 MB. Share the order confirmation page, or a screenshot of it.")
            }
            guard save(data, mime: kind.mime, name: name) else {
                return ("Couldn’t save it", "Something went wrong keeping it for Quids In. Paste the order into the app instead.")
            }
            return ("Saved for Quids In", "Open Quids In to finish adding it. It reads it on your phone; nothing is uploaded.")
        }()
        DispatchQueue.main.async { self.show(outcome.0, outcome.1, finished: true) }
    }

    private func save(_ data: Data, mime: String, name: String) -> Bool {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "KeptAppGroup") as? String,
              let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return false }
        let inbox = container.appendingPathComponent(Self.inboxFolder, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
            // The bytes first, then the note that says they are complete: the
            // app reads nothing without the note, so it never takes half a file.
            try data.write(to: inbox.appendingPathComponent(Self.dataName), options: .atomic)
            let note = try JSONSerialization.data(withJSONObject: ["name": name, "mime": mime])
            try note.write(to: inbox.appendingPathComponent(Self.noteName), options: .atomic)
            return true
        } catch {
            return false
        }
    }
}
