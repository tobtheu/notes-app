#include "bindings/bindings.h"
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

// ──────────────────────────────────────────────────────────────────────
// Fix: Force WKWebView to extend behind the iOS safe area (home bar).
//
// Tauri resets the WKWebView layout constraints AFTER app startup,
// overriding any one-shot fix. The solution: swizzle
// UIViewController's viewDidLayoutSubviews so our fix is reapplied
// every time iOS recalculates the layout — just like during rotation.
// ──────────────────────────────────────────────────────────────────────

static void fixWebViewInView(UIView *view, UIViewController *rootVC);
static void setupToolbar(WKWebView *webView);

// ── Native Editor Toolbar ──────────────────────────────────────────────

static WKWebView *gWebView = nil;
static BOOL gToolbarSetupDone = NO;

@class EditorAccessoryView;
static EditorAccessoryView *gToolbarView = nil;

@interface EditorAccessoryView : UIView
- (void)updateState:(NSDictionary *)state;
@end

@implementation EditorAccessoryView {
    NSDictionary<NSString *, UIButton *> *_actionButtons;
}

- (instancetype)init {
    self = [super initWithFrame:CGRectMake(0, 0, UIScreen.mainScreen.bounds.size.width, 44)];
    if (!self) return nil;
    self.autoresizingMask = UIViewAutoresizingFlexibleWidth;

    // Blur background
    UIBlurEffect *blur = [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemChromeMaterial];
    UIVisualEffectView *blurView = [[UIVisualEffectView alloc] initWithEffect:blur];
    blurView.frame = self.bounds;
    blurView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [self addSubview:blurView];

    // Top separator
    UIView *separator = [[UIView alloc] initWithFrame:CGRectMake(0, 0, self.bounds.size.width, 0.5)];
    separator.backgroundColor = [UIColor separatorColor];
    separator.autoresizingMask = UIViewAutoresizingFlexibleWidth;
    [self addSubview:separator];

    // Dismiss keyboard button (fixed right side)
    UIButton *dismissBtn = [self makeSystemButton:@"keyboard.chevron.compact.down" action:@"dismiss"];
    dismissBtn.frame = CGRectMake(self.bounds.size.width - 46, 0, 46, 44);
    dismissBtn.autoresizingMask = UIViewAutoresizingFlexibleLeftMargin;
    [self addSubview:dismissBtn];

    // Divider before dismiss
    UIView *dividerFixed = [[UIView alloc] initWithFrame:CGRectMake(self.bounds.size.width - 50, 8, 0.5, 28)];
    dividerFixed.backgroundColor = [UIColor separatorColor];
    dividerFixed.autoresizingMask = UIViewAutoresizingFlexibleLeftMargin;
    [self addSubview:dividerFixed];

    // Scrollable button strip
    UIScrollView *scroll = [[UIScrollView alloc] initWithFrame:CGRectMake(0, 0, self.bounds.size.width - 50, 44)];
    scroll.autoresizingMask = UIViewAutoresizingFlexibleWidth;
    scroll.showsHorizontalScrollIndicator = NO;
    scroll.showsVerticalScrollIndicator = NO;
    scroll.alwaysBounceHorizontal = YES;
    [self addSubview:scroll];

    // Button definitions: @[action, symbolName] or @[@"|"] for divider
    NSArray *defs = @[
        @[@"undo",        @"arrow.uturn.backward"],
        @[@"redo",        @"arrow.uturn.forward"],
        @[@"|"],
        @[@"bold",        @"bold"],
        @[@"italic",      @"italic"],
        @[@"highlight",   @"highlighter"],
        @[@"|"],
        @[@"h1",          @"H1"],
        @[@"h2",          @"H2"],
        @[@"h3",          @"H3"],
        @[@"|"],
        @[@"bulletList",  @"list.bullet"],
        @[@"taskList",    @"checklist"],
        @[@"|"],
        @[@"blockquote",  @"text.quote"],
        @[@"codeBlock",   @"chevron.left.forwardslash.chevron.right"],
        @[@"|"],
        @[@"link",        @"link"],
        @[@"image",       @"photo"],
    ];

    NSMutableDictionary *actionBtns = [NSMutableDictionary new];
    CGFloat x = 2;
    for (NSArray *item in defs) {
        if ([item[0] isEqualToString:@"|"]) {
            UIView *div = [[UIView alloc] initWithFrame:CGRectMake(x + 3, 10, 0.5, 24)];
            div.backgroundColor = [UIColor separatorColor];
            [scroll addSubview:div];
            x += 10;
        } else {
            NSString *action = item[0];
            NSString *symbol = item[1];
            UIButton *btn;
            if ([UIImage systemImageNamed:symbol]) {
                btn = [self makeSystemButton:symbol action:action];
            } else {
                btn = [self makeTextButton:symbol action:action];
            }
            btn.frame = CGRectMake(x, 0, 42, 44);
            [scroll addSubview:btn];
            actionBtns[action] = btn;
            x += 42;
        }
    }
    scroll.contentSize = CGSizeMake(x + 4, 44);
    _actionButtons = [actionBtns copy];
    return self;
}

- (UIButton *)makeSystemButton:(NSString *)symbolName action:(NSString *)action {
    UIButton *btn = [UIButton buttonWithType:UIButtonTypeSystem];
    UIImageSymbolConfiguration *cfg = [UIImageSymbolConfiguration configurationWithPointSize:16 weight:UIImageSymbolWeightRegular];
    UIImage *img = [UIImage systemImageNamed:symbolName withConfiguration:cfg];
    [btn setImage:img forState:UIControlStateNormal];
    btn.tintColor = [UIColor labelColor];
    btn.accessibilityLabel = action;
    [btn addTarget:self action:@selector(buttonTapped:) forControlEvents:UIControlEventTouchUpInside];
    return btn;
}

- (UIButton *)makeTextButton:(NSString *)text action:(NSString *)action {
    UIButton *btn = [UIButton buttonWithType:UIButtonTypeSystem];
    [btn setTitle:text forState:UIControlStateNormal];
    btn.titleLabel.font = [UIFont boldSystemFontOfSize:13];
    [btn setTitleColor:[UIColor labelColor] forState:UIControlStateNormal];
    btn.accessibilityLabel = action;
    [btn addTarget:self action:@selector(buttonTapped:) forControlEvents:UIControlEventTouchUpInside];
    return btn;
}

- (void)buttonTapped:(UIButton *)sender {
    NSString *action = sender.accessibilityLabel;
    if ([action isEqualToString:@"dismiss"]) {
        [gWebView endEditing:YES];
        return;
    }
    if (gWebView) {
        NSString *js = [NSString stringWithFormat:@"window.toolbarAction && window.toolbarAction('%@')", action];
        [gWebView evaluateJavaScript:js completionHandler:nil];
    }
}

- (void)updateState:(NSDictionary *)state {
    UIColor *active = [UIColor systemBlueColor];
    UIColor *normal = [UIColor labelColor];

    NSArray *toggleable = @[@"bold", @"italic", @"highlight", @"h1", @"h2", @"h3",
                             @"bulletList", @"taskList", @"blockquote", @"codeBlock", @"link"];
    for (NSString *key in toggleable) {
        UIButton *btn = _actionButtons[key];
        if (!btn) continue;
        BOOL isActive = [state[key] boolValue];
        UIColor *color = isActive ? active : normal;
        btn.tintColor = color;
        [btn setTitleColor:color forState:UIControlStateNormal];
    }
}

@end

// ── Script message handler (JS → Native toolbar state) ─────────────────

@interface ToolbarStateHandler : NSObject <WKScriptMessageHandler>
@end

@implementation ToolbarStateHandler
- (void)userContentController:(WKUserContentController *)ucc didReceiveScriptMessage:(WKScriptMessage *)message {
    if (![message.body isKindOfClass:[NSDictionary class]]) return;
    NSDictionary *state = message.body;
    dispatch_async(dispatch_get_main_queue(), ^{
        [gToolbarView updateState:state];
    });
}
@end

static void setupToolbar(WKWebView *webView) {
    if (gToolbarSetupDone) return;
    gToolbarSetupDone = YES;
    gWebView = webView;

    gToolbarView = [[EditorAccessoryView alloc] init];

    // Register message handler for active-state updates from Tiptap
    ToolbarStateHandler *handler = [[ToolbarStateHandler alloc] init];
    [webView.configuration.userContentController addScriptMessageHandler:handler name:@"toolbarState"];
}

// ── WKWebView layout + toolbar setup ──────────────────────────────────

static void fixWebViewInView(UIView *view, UIViewController *rootVC) {
    if ([view isKindOfClass:[WKWebView class]]) {
        WKWebView *webview = (WKWebView *)view;

        if (webview.scrollView.contentInsetAdjustmentBehavior != UIScrollViewContentInsetAdjustmentNever) {
            webview.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
        }

        if (rootVC.edgesForExtendedLayout != UIRectEdgeAll) {
            rootVC.edgesForExtendedLayout = UIRectEdgeAll;
            rootVC.extendedLayoutIncludesOpaqueBars = YES;
        }

        if (!UIEdgeInsetsEqualToEdgeInsets(rootVC.additionalSafeAreaInsets, UIEdgeInsetsZero)) {
            rootVC.additionalSafeAreaInsets = UIEdgeInsetsZero;
        }

        // Ensure webview fills its parent
        if (webview.superview && !CGRectEqualToRect(webview.frame, webview.superview.bounds)) {
            webview.frame = webview.superview.bounds;
            webview.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
        }

        // One-time toolbar setup once we have a reference to the WKWebView
        setupToolbar(webview);
        return;
    }
    for (UIView *subview in view.subviews) {
        fixWebViewInView(subview, rootVC);
    }
}

// ── Swizzle UIViewController.viewDidLayoutSubviews ──────────────────

static IMP sOriginalViewDidLayoutSubviews = NULL;

static void swizzled_viewDidLayoutSubviews(id self, SEL _cmd) {
    if (sOriginalViewDidLayoutSubviews) {
        ((void(*)(id, SEL))sOriginalViewDidLayoutSubviews)(self, _cmd);
    }
    UIViewController *vc = (UIViewController *)self;
    if (vc.view.window && vc == vc.view.window.rootViewController) {
        fixWebViewInView(vc.view, vc);
    }
}

__attribute__((constructor))
static void setupFullscreenHook(void) {
    // Swizzle UIViewController.viewDidLayoutSubviews for layout fixes + toolbar setup
    Method original = class_getInstanceMethod([UIViewController class], @selector(viewDidLayoutSubviews));
    sOriginalViewDidLayoutSubviews = method_getImplementation(original);
    method_setImplementation(original, (IMP)swizzled_viewDidLayoutSubviews);

    // Swizzle WKContentView.inputAccessoryView to inject our native toolbar.
    // WKContentView is the private first-responder inside WKWebView that owns the keyboard.
    Class wkContentViewClass = NSClassFromString(@"WKContentView");
    if (wkContentViewClass) {
        SEL sel = @selector(inputAccessoryView);
        IMP newImp = imp_implementationWithBlock(^UIView *(id _self) {
            return gToolbarView; // nil until setupToolbar runs (harmless)
        });
        Method existing = class_getInstanceMethod(wkContentViewClass, sel);
        if (existing) {
            method_setImplementation(existing, newImp);
        } else {
            class_addMethod(wkContentViewClass, sel, newImp, "@@:");
        }
    }
}

int main(int argc, char * argv[]) {
	ffi::start_app();
	return 0;
}
