import FaqsPage from "../pages/faqs";
import { getSystemInfo } from "zmp-sdk";
import {
  AnimationRoutes,
  App,
  Route,
  SnackbarProvider,
  ZMPRouter,
} from "zmp-ui";

import AppBottomNavigation from "./bottom-nav";
import HomePage from "../pages/index";
import ProceduresPage from "../pages/procedures";
import ProcedureDetailPage from "../pages/procedure-detail";
import PostsPage from "../pages/posts";
import PostDetailPage from "../pages/post-detail";
import NoticesPage from "../pages/notices";
import AccountPage from "../pages/account";
import QueuePage from "../pages/queue";

const Layout = () => {
  return (
    <App theme={getSystemInfo().zaloTheme}>
      <SnackbarProvider>
        <ZMPRouter>
          <AnimationRoutes>
            <Route path="/" element={<HomePage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/procedures" element={<ProceduresPage />} />
            <Route path="/procedures/:id" element={<ProcedureDetailPage />} />
            <Route path="/posts" element={<PostsPage />} />
            <Route path="/posts/:id" element={<PostDetailPage />} />
            <Route path="/notices" element={<NoticesPage />} />
            <Route path="/faqs" element={<FaqsPage />} />
            <Route path="/account" element={<AccountPage />} />
          </AnimationRoutes>
          <AppBottomNavigation />
        </ZMPRouter>
      </SnackbarProvider>
    </App>
  );
};
export default Layout;
