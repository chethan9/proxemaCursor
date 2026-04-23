import type { GetServerSideProps } from "next";
import { useState } from "react";
import { useRouter
...
ncy={currency} onSubscribe={() => handleSubscribe(p.id)} loading={loading} />)}
        </div>
      </main>
    </div>
  );
}